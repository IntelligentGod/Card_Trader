import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type AuthProviderType } from '@prisma/client';
import type { AuthResponse, AuthTokens, LoginResponse, MeResponse } from '@card-trader/shared';
import { inactiveAccountError } from '../../common/auth/jwt-auth.guard';
import { Errors } from '../../common/errors/app.exception';
import { generatePublicId } from '../../common/utils/ids';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserMapper, userProfileInclude, type UserWithProfile } from '../users/user.mapper';
import type { AppleSignInDto, ChangePasswordDto, LoginDto, RegisterDto, TwoFactorVerifyDto } from './dto/auth.dto';
import { EmailVerificationService } from './email-verification.service';
import { OidcVerifier, type VerifiedIdentity } from './oidc-verifier';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { CHALLENGE_TTL_SECONDS, TwoFactorService } from './two-factor.service';

const INVALID_CREDENTIALS = 'Invalid email or password';
/** Per-account lockout on top of the per-IP rate limit. */
export const MAX_FAILED_LOGINS = 5;
export const LOGIN_LOCK_MINUTES = 15;

export const usernameTaken = () => Errors.conflict('USERNAME_TAKEN', 'That username is taken');

/** A valid, unused-looking handle from an email or name: [a-z0-9_]{3,20}. */
export function usernameBase(email: string | null, name: string | null): string {
  const source = (email?.split('@')[0] ?? name ?? '').toLowerCase();
  const cleaned = source.replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const base = cleaned.slice(0, 15);
  return base.length >= 3 ? base : `collector${base}`.slice(0, 15);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly users: UserMapper,
    private readonly oidc: OidcVerifier,
    private readonly twoFactor: TwoFactorService,
    private readonly emailVerification: EmailVerificationService,
    private readonly notifications: NotificationsService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const weakness = this.passwords.weaknessReason(dto.password, dto.email);
    if (weakness) throw Errors.badRequest('WEAK_PASSWORD', weakness);

    const taken = await this.prisma.profile.findUnique({ where: { username: dto.username }, select: { userId: true } });
    if (taken) throw usernameTaken();

    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.createUser({
      email: dto.email,
      passwordHash,
      username: dto.username,
      displayName: dto.displayName,
      emailVerified: false,
      provider: null,
    });
    // The account exists either way; a mail outage must not fail sign-up (they can resend).
    await this.emailVerification.send(user.id, { enforceLimits: false }).catch((error: unknown) => {
      this.logger.error(`Verification email to user ${user.id} failed: ${String(error)}`);
    });
    const tokens = await this.tokens.issue(user);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { user: this.users.toMe(user), tokens };
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email }, include: userProfileInclude });
    if (user?.loginLockedUntil && user.loginLockedUntil > new Date()) {
      const minutes = Math.ceil((user.loginLockedUntil.getTime() - Date.now()) / 60_000);
      throw Errors.tooManyRequests('ACCOUNT_LOCKED', `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
    }
    // Always run a verification so response time does not reveal whether the email exists.
    const valid = await this.passwords.verify(user?.passwordHash ?? null, dto.password);
    if (!user || !valid) {
      if (user) await this.recordFailedLogin(user.id, user.failedLoginCount);
      throw Errors.unauthorized('INVALID_CREDENTIALS', INVALID_CREDENTIALS);
    }
    // Only after the password is right, so the status doesn't reveal accounts to guessers.
    if (user.status !== 'ACTIVE') throw inactiveAccountError(user.status);
    if (user.failedLoginCount > 0 || user.loginLockedUntil) {
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, loginLockedUntil: null } });
    }
    return this.finishFirstFactor(user, 'PASSWORD');
  }

  async signInWithGoogle(idToken: string): Promise<LoginResponse> {
    return this.signInWithIdentity(await this.oidc.google(idToken), null);
  }

  async signInWithApple(dto: AppleSignInDto): Promise<LoginResponse> {
    const name = [dto.fullName?.givenName, dto.fullName?.familyName].filter(Boolean).join(' ').trim() || null;
    return this.signInWithIdentity(await this.oidc.apple(dto.identityToken, dto.nonce), name);
  }

  async completeTwoFactor(dto: TwoFactorVerifyDto): Promise<AuthResponse> {
    const { userId } = await this.twoFactor.completeChallenge(dto.challengeToken, { code: dto.code, recoveryCode: dto.recoveryCode });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: userProfileInclude });
    if (user.status !== 'ACTIVE') throw inactiveAccountError(user.status);
    return this.startSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const { tokens } = await this.tokens.rotate(refreshToken);
    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  /**
   * Sets a new password and signs out every other session. The current
   * password is required unless an admin reset it or the account has none yet
   * (Google/Apple only).
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: userProfileInclude });
    const needsCurrent = user.passwordHash !== null && !user.mustChangePassword;
    if (needsCurrent) {
      if (!dto.currentPassword || !(await this.passwords.verify(user.passwordHash, dto.currentPassword))) {
        throw Errors.badRequest('WRONG_PASSWORD', 'Your current password is not correct');
      }
    }
    const weakness = this.passwords.weaknessReason(dto.newPassword, user.email);
    if (weakness) throw Errors.badRequest('WEAK_PASSWORD', weakness);
    if (user.passwordHash && (await this.passwords.verify(user.passwordHash, dto.newPassword))) {
      throw Errors.badRequest('PASSWORD_REUSED', 'Choose a password you have not used for this account');
    }

    const passwordHash = await this.passwords.hash(dto.newPassword);
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.user.update({
        where: { id: userId },
        data: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: false, failedLoginCount: 0, loginLockedUntil: null },
        include: userProfileInclude,
      });
      await tx.userAuthProvider.upsert({
        where: { userId_provider: { userId, provider: 'PASSWORD' } },
        create: { userId, provider: 'PASSWORD', providerUserId: userId, providerEmail: user.email },
        update: {},
      });
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.notifications.notify(tx, {
        userId,
        type: 'ACCOUNT_SECURITY',
        title: 'Password changed',
        body: 'Your password was changed and other devices were signed out.',
      });
      return next;
    });
    return { user: this.users.toMe(updated), tokens: await this.tokens.issue(updated) };
  }

  async linkProvider(userId: string, identity: VerifiedIdentity): Promise<MeResponse> {
    const existing = await this.prisma.userAuthProvider.findUnique({
      where: { provider_providerUserId: { provider: identity.provider, providerUserId: identity.subject } },
    });
    if (existing && existing.userId !== userId) {
      throw Errors.conflict('PROVIDER_ALREADY_LINKED', `That ${providerName(identity.provider)} account is already used by another Card Trader account`);
    }
    if (!existing) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.userAuthProvider.create({
            data: { userId, provider: identity.provider, providerUserId: identity.subject, providerEmail: identity.email },
          });
          await this.notifications.notify(tx, {
            userId,
            type: 'ACCOUNT_SECURITY',
            title: `${providerName(identity.provider)} sign-in added`,
            body: `You can now sign in with ${providerName(identity.provider)}.`,
          });
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw Errors.conflict('PROVIDER_ALREADY_LINKED', `A ${providerName(identity.provider)} account is already linked`);
        }
        throw error;
      }
    }
    return this.users.toMe(await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: userProfileInclude }));
  }

  /** Removes Google or Apple, as long as another way to sign in remains. */
  async unlinkProvider(userId: string, provider: 'GOOGLE' | 'APPLE'): Promise<MeResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: userProfileInclude });
    const others = user.authProviders.filter((p) => p.provider !== provider && (p.provider !== 'PASSWORD' || user.passwordHash));
    if (!user.authProviders.some((p) => p.provider === provider)) throw Errors.notFound('PROVIDER_NOT_LINKED', 'That sign-in method is not linked');
    if (others.length === 0) {
      throw Errors.conflict('LAST_SIGN_IN_METHOD', 'Set a password or link another sign-in method first, so you can still sign in');
    }
    await this.prisma.userAuthProvider.delete({ where: { userId_provider: { userId, provider } } });
    return this.users.toMe(await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: userProfileInclude }));
  }

  verifyGoogle(idToken: string): Promise<VerifiedIdentity> {
    return this.oidc.google(idToken);
  }

  verifyApple(identityToken: string, nonce: string): Promise<VerifiedIdentity> {
    return this.oidc.apple(identityToken, nonce);
  }

  /**
   * Finds the account for a verified Google/Apple identity:
   *  1. already linked → that account;
   *  2. same email on an account whose email is verified → link it (both sides proved the inbox);
   *  3. same email on an unverified account → refuse (someone may have registered the address first);
   *  4. otherwise create a new, already-verified account.
   */
  private async signInWithIdentity(identity: VerifiedIdentity, appleName: string | null): Promise<LoginResponse> {
    const linked = await this.prisma.userAuthProvider.findUnique({
      where: { provider_providerUserId: { provider: identity.provider, providerUserId: identity.subject } },
      include: { user: { include: userProfileInclude } },
    });
    if (linked) return this.checkStatusAndFinish(linked.user, identity.provider);

    if (!identity.email || !identity.emailVerified) {
      throw Errors.unprocessable('PROVIDER_EMAIL_UNVERIFIED', `Your ${providerName(identity.provider)} account has no verified email to sign in with`);
    }
    const byEmail = await this.prisma.user.findUnique({ where: { email: identity.email }, include: userProfileInclude });
    if (byEmail) {
      if (!byEmail.emailVerifiedAt) {
        throw Errors.conflict(
          'ACCOUNT_EXISTS_UNVERIFIED',
          `An account with this email already exists. Sign in with your password, verify your email, then add ${providerName(identity.provider)} in Settings → Security.`,
        );
      }
      if (byEmail.status !== 'ACTIVE') throw inactiveAccountError(byEmail.status);
      await this.prisma.userAuthProvider.create({
        data: { userId: byEmail.id, provider: identity.provider, providerUserId: identity.subject, providerEmail: identity.email },
      });
      const refreshed = await this.prisma.user.findUniqueOrThrow({ where: { id: byEmail.id }, include: userProfileInclude });
      return this.finishFirstFactor(refreshed, identity.provider);
    }

    const name = identity.name ?? appleName;
    const created = await this.createUser({
      email: identity.email,
      passwordHash: null,
      username: await this.availableUsername(usernameBase(identity.email, name)),
      displayName: displayNameFrom(name, identity.email),
      emailVerified: true,
      provider: { type: identity.provider, subject: identity.subject },
    });
    return this.finishFirstFactor(created, identity.provider);
  }

  private checkStatusAndFinish(user: UserWithProfile, method: AuthProviderType): Promise<LoginResponse> {
    if (user.status !== 'ACTIVE') throw inactiveAccountError(user.status);
    return this.finishFirstFactor(user, method);
  }

  /** The first factor is proven: either a 2FA challenge or the session. */
  private async finishFirstFactor(user: UserWithProfile, method: AuthProviderType): Promise<LoginResponse> {
    if (user.twoFactorEnabled) {
      return { twoFactorRequired: true, challengeToken: await this.twoFactor.createChallenge(user.id, method), expiresIn: CHALLENGE_TTL_SECONDS };
    }
    return this.startSession(user);
  }

  private async startSession(user: UserWithProfile): Promise<AuthResponse> {
    const tokens = await this.tokens.issue(user);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { user: this.users.toMe(user), tokens };
  }

  private async recordFailedLogin(userId: string, previousFailures: number): Promise<void> {
    const failures = previousFailures + 1;
    await this.prisma.user.update({
      where: { id: userId },
      data:
        failures >= MAX_FAILED_LOGINS
          ? { failedLoginCount: 0, loginLockedUntil: new Date(Date.now() + LOGIN_LOCK_MINUTES * 60_000) }
          : { failedLoginCount: failures },
    });
  }

  private async availableUsername(base: string): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = attempt === 0 ? base : `${base.slice(0, 15)}_${Math.floor(1000 + Math.random() * 9000)}`;
      const taken = await this.prisma.profile.findUnique({ where: { username: candidate }, select: { userId: true } });
      if (!taken) return candidate;
    }
    return `collector_${generatePublicId().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 9)}`;
  }

  private async createUser(input: {
    email: string;
    passwordHash: string | null;
    username: string;
    displayName: string;
    emailVerified: boolean;
    provider: { type: AuthProviderType; subject: string } | null;
  }): Promise<UserWithProfile> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: input.email,
              passwordHash: input.passwordHash,
              publicId: generatePublicId(),
              emailVerifiedAt: input.emailVerified ? new Date() : null,
              profile: { create: { username: input.username, displayName: input.displayName } },
            },
          });
          await tx.userAuthProvider.create({
            data: input.provider
              ? { userId: user.id, provider: input.provider.type, providerUserId: input.provider.subject, providerEmail: input.email }
              : { userId: user.id, provider: 'PASSWORD', providerUserId: user.id, providerEmail: input.email },
          });
          return tx.user.findUniqueOrThrow({ where: { id: user.id }, include: userProfileInclude });
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const target = String((error.meta as { target?: unknown } | undefined)?.target ?? '');
          if (target.includes('email')) throw Errors.conflict('EMAIL_TAKEN', 'An account with this email already exists');
          if (target.includes('username')) throw usernameTaken();
          if (target.includes('provider')) throw Errors.conflict('PROVIDER_ALREADY_LINKED', 'That sign-in is already linked to an account');
          continue; // public id collision (astronomically rare): retry with a new one
        }
        throw error;
      }
    }
    throw new Error('Could not allocate a unique public id');
  }
}

export function providerName(provider: AuthProviderType): string {
  return provider === 'GOOGLE' ? 'Google' : provider === 'APPLE' ? 'Apple' : 'password';
}

/** 2–40 characters from the allowed set, falling back to the email name. */
function displayNameFrom(name: string | null, email: string): string {
  const cleaned = (name ?? email.split('@')[0] ?? '').replace(/[^\p{L}\p{N} ._'-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  return cleaned.length >= 2 ? cleaned : 'Collector';
}
