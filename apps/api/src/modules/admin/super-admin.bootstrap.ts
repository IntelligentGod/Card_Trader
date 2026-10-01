import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { generatePublicId } from '../../common/utils/ids';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { usernameBase } from '../auth/auth.service';
import { PasswordService } from '../auth/password.service';

/**
 * Creates the super admin on first start from SUPER_ADMIN_EMAIL and
 * SUPER_ADMIN_INITIAL_PASSWORD (environment only; never in code or git).
 * The password is hashed at once and must be changed at first sign-in.
 *
 * It never promotes an existing account: if that email was registered first
 * (possibly by someone else), it logs a warning and an operator decides
 * (npm run admin:super -w @card-trader/api -- <email>).
 */
@Injectable()
export class SuperAdminBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(SuperAdminBootstrap.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly passwords: PasswordService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config.get('SUPER_ADMIN_EMAIL')?.trim().toLowerCase();
    if (!email) return;

    const existing = await this.prisma.user.findUnique({ where: { email }, select: { role: true } });
    if (existing) {
      if (existing.role !== 'SUPER_ADMIN') {
        this.logger.warn(`SUPER_ADMIN_EMAIL ${email} already belongs to a ${existing.role} account; it was not promoted automatically.`);
      }
      return;
    }

    const password = this.config.get('SUPER_ADMIN_INITIAL_PASSWORD');
    if (!password) {
      this.logger.warn('SUPER_ADMIN_EMAIL is set but SUPER_ADMIN_INITIAL_PASSWORD is not; the super admin was not created.');
      return;
    }
    const weakness = this.passwords.weaknessReason(password, email);
    if (weakness) {
      this.logger.error(`SUPER_ADMIN_INITIAL_PASSWORD rejected (${weakness}); the super admin was not created.`);
      return;
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await this.passwords.hash(password),
        publicId: generatePublicId(),
        role: 'SUPER_ADMIN',
        // The operator chose this address in the server configuration.
        emailVerifiedAt: new Date(),
        mustChangePassword: true,
        profile: { create: { username: await this.freeUsername(usernameBase(email, null)), displayName: 'Card Trader Support' } },
      },
    });
    await this.prisma.userAuthProvider.create({ data: { userId: user.id, provider: 'PASSWORD', providerUserId: user.id, providerEmail: email } });
    this.logger.log(`Super admin ${email} created. Sign in and choose a new password; then remove SUPER_ADMIN_INITIAL_PASSWORD from the environment.`);
  }

  private async freeUsername(base: string): Promise<string> {
    for (let i = 0; i < 20; i++) {
      const candidate = i === 0 ? base : `${base.slice(0, 15)}_${i}`;
      if (!(await this.prisma.profile.findUnique({ where: { username: candidate }, select: { userId: true } }))) return candidate;
    }
    return `admin_${Date.now() % 1_000_000}`;
  }
}
