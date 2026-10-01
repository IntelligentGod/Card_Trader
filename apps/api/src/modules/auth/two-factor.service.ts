import { Injectable } from '@nestjs/common';
import type { AuthProviderType } from '@prisma/client';
import type { RecoveryCodesResponse, TwoFactorSetupResponse } from '@card-trader/shared';
import { Errors } from '../../common/errors/app.exception';
import { SecretBox } from '../../common/security/secret-box';
import {
  generateRecoveryCodes,
  generateTotpSecret,
  normalizeRecoveryCode,
  otpauthUrl,
  verifyTotp,
} from '../../common/security/totp';
import { generateOpaqueToken, sha256Hex } from '../../common/utils/ids';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export const CHALLENGE_TTL_SECONDS = 300;
const MAX_CHALLENGE_ATTEMPTS = 5;

/** Either a 6-digit authenticator code or one unused recovery code. */
export interface SecondFactor {
  code?: string;
  recoveryCode?: string;
}

const invalidCode = () => Errors.unauthorized('INVALID_2FA_CODE', 'That code is not correct. Try the newest code from your app.');

/**
 * TOTP two-factor authentication. Secrets are encrypted at rest and never
 * leave the server after setup; recovery codes are shown once and stored as
 * SHA-256. A sign-in with 2FA on gets a short-lived challenge instead of a
 * session until the second factor is proven.
 */
@Injectable()
export class TwoFactorService {
  private box: SecretBox | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly notifications: NotificationsService,
  ) {}

  /** Step 1: a new secret, stored encrypted but not active until a code proves the app has it. */
  async beginSetup(userId: string): Promise<TwoFactorSetupResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, twoFactorEnabled: true } });
    if (user.twoFactorEnabled) throw Errors.conflict('2FA_ALREADY_ENABLED', 'Two-factor authentication is already on');
    const secret = generateTotpSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecretEncrypted: this.secretBox().seal(secret), twoFactorLastStep: null },
    });
    return { secret, otpauthUrl: otpauthUrl(this.config.get('TWO_FACTOR_ISSUER'), user.email, secret) };
  }

  /** Step 2: the first correct code turns 2FA on and returns recovery codes (only now, only once). */
  async enable(userId: string, code: string): Promise<RecoveryCodesResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { twoFactorEnabled: true, twoFactorSecretEncrypted: true, twoFactorLastStep: true },
    });
    if (user.twoFactorEnabled) throw Errors.conflict('2FA_ALREADY_ENABLED', 'Two-factor authentication is already on');
    if (!user.twoFactorSecretEncrypted) throw Errors.badRequest('2FA_SETUP_REQUIRED', 'Start the setup again to get a new QR code');
    const step = verifyTotp(this.secretBox().open(user.twoFactorSecretEncrypted), code, Date.now(), user.twoFactorLastStep);
    if (step === null) throw invalidCode();

    const codes = generateRecoveryCodes();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { twoFactorEnabled: true, twoFactorLastStep: step } });
      await this.replaceRecoveryCodes(tx, userId, codes);
      await this.securityNotice(tx, userId, 'Two-factor authentication turned on', 'Signing in now also needs a code from your authenticator app.');
    });
    return { recoveryCodes: codes };
  }

  async disable(userId: string, proof: SecondFactor): Promise<void> {
    await this.requireEnabled(userId);
    await this.consume(userId, proof);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: false, twoFactorSecretEncrypted: null, twoFactorLastStep: null },
      });
      await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
      await this.securityNotice(tx, userId, 'Two-factor authentication turned off', 'If this wasn’t you, change your password now and turn it back on.');
    });
  }

  async regenerateRecoveryCodes(userId: string, proof: SecondFactor): Promise<RecoveryCodesResponse> {
    await this.requireEnabled(userId);
    await this.consume(userId, proof);
    const codes = generateRecoveryCodes();
    await this.prisma.$transaction((tx) => this.replaceRecoveryCodes(tx, userId, codes));
    return { recoveryCodes: codes };
  }

  /** A correct first factor on an account with 2FA: returns the challenge token (no session yet). */
  async createChallenge(userId: string, method: AuthProviderType): Promise<string> {
    const token = generateOpaqueToken();
    await this.prisma.loginChallenge.create({
      data: { userId, method, tokenHash: sha256Hex(token), expiresAt: new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000) },
    });
    return token;
  }

  /**
   * Proves the second factor for a challenge. Five wrong codes burn the
   * challenge, so guessing needs a new password sign-in each time.
   */
  async completeChallenge(challengeToken: string, proof: SecondFactor): Promise<{ userId: string; method: AuthProviderType }> {
    const challenge = await this.prisma.loginChallenge.findUnique({ where: { tokenHash: sha256Hex(challengeToken) } });
    if (!challenge || challenge.usedAt || challenge.expiresAt <= new Date() || challenge.attempts >= MAX_CHALLENGE_ATTEMPTS) {
      throw Errors.unauthorized('2FA_CHALLENGE_EXPIRED', 'This sign-in expired. Please sign in again.');
    }
    try {
      await this.consume(challenge.userId, proof);
    } catch (error) {
      await this.prisma.loginChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      throw error;
    }
    const claimed = await this.prisma.loginChallenge.updateMany({ where: { id: challenge.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw Errors.unauthorized('2FA_CHALLENGE_EXPIRED', 'This sign-in expired. Please sign in again.');
    return { userId: challenge.userId, method: challenge.method };
  }

  /** Accepts a TOTP code (newer than the last one used) or burns one recovery code. */
  private async consume(userId: string, proof: SecondFactor): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { twoFactorEnabled: true, twoFactorSecretEncrypted: true, twoFactorLastStep: true },
    });
    if (!user.twoFactorEnabled || !user.twoFactorSecretEncrypted) throw Errors.badRequest('2FA_NOT_ENABLED', 'Two-factor authentication is off');

    if (proof.code) {
      const step = verifyTotp(this.secretBox().open(user.twoFactorSecretEncrypted), proof.code, Date.now(), user.twoFactorLastStep);
      if (step === null) throw invalidCode();
      // Conditional: two requests with the same code cannot both succeed.
      const updated = await this.prisma.user.updateMany({
        where: { id: userId, OR: [{ twoFactorLastStep: null }, { twoFactorLastStep: { lt: step } }] },
        data: { twoFactorLastStep: step },
      });
      if (updated.count !== 1) throw invalidCode();
      return;
    }
    if (proof.recoveryCode) {
      const used = await this.prisma.twoFactorRecoveryCode.updateMany({
        where: { userId, usedAt: null, codeHash: sha256Hex(normalizeRecoveryCode(proof.recoveryCode)) },
        data: { usedAt: new Date() },
      });
      if (used.count !== 1) throw Errors.unauthorized('INVALID_RECOVERY_CODE', 'That recovery code is not valid or was already used.');
      return;
    }
    throw Errors.badRequest('2FA_CODE_REQUIRED', 'Enter the code from your authenticator app or a recovery code');
  }

  private async requireEnabled(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { twoFactorEnabled: true } });
    if (!user.twoFactorEnabled) throw Errors.badRequest('2FA_NOT_ENABLED', 'Two-factor authentication is off');
  }

  private async replaceRecoveryCodes(tx: Tx, userId: string, codes: string[]): Promise<void> {
    await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
    await tx.twoFactorRecoveryCode.createMany({
      data: codes.map((code) => ({ userId, codeHash: sha256Hex(normalizeRecoveryCode(code)) })),
    });
  }

  private securityNotice(tx: Tx, userId: string, title: string, body: string): Promise<void> {
    return this.notifications.notify(tx, { userId, type: 'ACCOUNT_SECURITY', title, body });
  }

  private secretBox(): SecretBox {
    if (!this.box) {
      const key = this.config.get('TWO_FACTOR_ENCRYPTION_KEY');
      if (!key) throw Errors.unprocessable('2FA_NOT_CONFIGURED', 'Two-factor authentication is not set up on this server');
      this.box = new SecretBox(key);
    }
    return this.box;
  }
}
