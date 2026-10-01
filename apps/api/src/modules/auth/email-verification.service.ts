import { Injectable } from '@nestjs/common';
import { Errors } from '../../common/errors/app.exception';
import { generateOpaqueToken, sha256Hex } from '../../common/utils/ids';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { verifyEmailMessage } from '../mail/templates';

const RESEND_COOLDOWN_MS = 60_000;
const MAX_PER_HOUR = 5;

export type VerifyOutcome = 'VERIFIED' | 'ALREADY_VERIFIED';

/**
 * Email ownership proof. The emailed token is 256 random bits; only its
 * SHA-256 is stored, it expires, and it works once.
 */
@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: AppConfig,
  ) {}

  /** Sends a fresh link. Rate limited per account: 1 per minute, 5 per hour. */
  async send(userId: string, options: { enforceLimits: boolean } = { enforceLimits: true }): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerifiedAt: true, profile: { select: { displayName: true } } },
    });
    if (!user) throw Errors.notFound('USER_NOT_FOUND', 'User not found');
    if (user.emailVerifiedAt) throw Errors.conflict('EMAIL_ALREADY_VERIFIED', 'Your email is already verified');

    if (options.enforceLimits) {
      const recent = await this.prisma.emailVerificationToken.findMany({
        where: { userId, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      const latest = recent[0];
      if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
        throw Errors.tooManyRequests('RESEND_TOO_SOON', 'Please wait a minute before asking for another email');
      }
      if (recent.length >= MAX_PER_HOUR) {
        throw Errors.tooManyRequests('RESEND_LIMIT', 'Too many verification emails. Please try again in an hour.');
      }
    }

    const token = generateOpaqueToken();
    const ttlHours = this.config.get('EMAIL_VERIFICATION_TTL_HOURS');
    await this.prisma.emailVerificationToken.create({
      data: { userId, tokenHash: sha256Hex(token), expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000) },
    });
    const link = `${this.config.get('PUBLIC_BASE_URL').replace(/\/$/, '')}/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`;
    await this.mail.send(verifyEmailMessage(user.email, user.profile?.displayName ?? 'collector', link, ttlHours));
  }

  /** Consumes a token. Invalid, expired and already-used tokens all fail the same way. */
  async verify(token: string): Promise<VerifyOutcome> {
    const now = new Date();
    const row = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: sha256Hex(token) },
      include: { user: { select: { emailVerifiedAt: true, email: true } } },
    });
    if (!row || row.usedAt || row.expiresAt <= now) {
      throw Errors.badRequest('VERIFICATION_LINK_INVALID', 'This verification link is invalid or has expired. Request a new one from the app.');
    }
    // Conditional update: two clicks at once cannot both consume the token.
    const claimed = await this.prisma.emailVerificationToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
    if (claimed.count !== 1) {
      throw Errors.badRequest('VERIFICATION_LINK_INVALID', 'This verification link is invalid or has expired. Request a new one from the app.');
    }
    if (row.user.emailVerifiedAt) return 'ALREADY_VERIFIED';
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: now } }),
      // Older links for this account stop working.
      this.prisma.emailVerificationToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: now } }),
    ]);
    return 'VERIFIED';
  }
}
