import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import type { AuthTokens } from '@card-trader/shared';
import type { AccessTokenPayload } from '../../common/auth/auth-user';
import { Errors } from '../../common/errors/app.exception';
import { addDays } from '../../common/utils/dates';
import { generateOpaqueToken, sha256Hex } from '../../common/utils/ids';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Access tokens: short-lived HS256 JWTs.
 * Refresh tokens: opaque random strings, stored only as SHA-256 hashes, rotated
 * on every use. Re-using a rotated token revokes the whole family (theft signal).
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
  ) {}

  async issue(user: { id: string; publicId: string }, familyId: string = randomUUID()): Promise<AuthTokens> {
    const refreshToken = generateOpaqueToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: sha256Hex(refreshToken),
        expiresAt: addDays(new Date(), this.config.get('REFRESH_TOKEN_TTL_DAYS')),
      },
    });
    return { accessToken: await this.signAccess(user), refreshToken, accessTokenExpiresIn: this.accessTtl };
  }

  async rotate(presentedToken: string): Promise<{ userId: string; tokens: AuthTokens }> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256Hex(presentedToken) },
      include: { user: { select: { id: true, publicId: true, status: true } } },
    });
    if (!existing) throw Errors.unauthorized('REFRESH_TOKEN_INVALID', 'Session expired, please sign in again');

    if (existing.revokedAt) {
      this.logger.warn(`Refresh token reuse detected for family ${existing.familyId}; revoking family`);
      await this.revokeFamily(existing.familyId);
      throw Errors.unauthorized('REFRESH_TOKEN_REUSED', 'Session expired, please sign in again');
    }
    if (existing.expiresAt <= new Date() || existing.user.status !== 'ACTIVE') {
      throw Errors.unauthorized('REFRESH_TOKEN_INVALID', 'Session expired, please sign in again');
    }

    const nextToken = generateOpaqueToken();
    const nextId = randomUUID();
    const rotated = await this.prisma.$transaction(async (tx) => {
      // Conditional update: only one concurrent request can rotate a given token.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedById: nextId },
      });
      if (claimed.count !== 1) return false;
      await tx.refreshToken.create({
        data: {
          id: nextId,
          userId: existing.userId,
          familyId: existing.familyId,
          tokenHash: sha256Hex(nextToken),
          expiresAt: addDays(new Date(), this.config.get('REFRESH_TOKEN_TTL_DAYS')),
        },
      });
      return true;
    });
    if (!rotated) {
      await this.revokeFamily(existing.familyId);
      throw Errors.unauthorized('REFRESH_TOKEN_REUSED', 'Session expired, please sign in again');
    }

    return {
      userId: existing.userId,
      tokens: {
        accessToken: await this.signAccess(existing.user),
        refreshToken: nextToken,
        accessTokenExpiresIn: this.accessTtl,
      },
    };
  }

  /** Logout: revokes the presented token's whole family. Unknown tokens are ignored. */
  async revoke(presentedToken: string): Promise<void> {
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256Hex(presentedToken) } });
    if (existing) await this.revokeFamily(existing.familyId);
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private get accessTtl(): number {
    return this.config.get('JWT_ACCESS_TTL_SECONDS');
  }

  private signAccess(user: { id: string; publicId: string }): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, pid: user.publicId, typ: 'access' };
    return this.jwt.signAsync(payload, { expiresIn: this.accessTtl, algorithm: 'HS256' });
  }
}
