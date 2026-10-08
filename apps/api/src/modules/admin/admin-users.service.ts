import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AdminAuditEntry, AdminUserDetail } from '@card-trader/shared';
import { Errors } from '../../common/errors/app.exception';
import { generatePublicId } from '../../common/utils/ids';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import { PasswordService } from '../auth/password.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../uploads/storage.service';
import { userProfileInclude } from '../users/user.mapper';
import { AdminAuditService, diffFields, type FieldChanges } from './admin-audit.service';
import { AuditAction, permissionsFor, visibleAccounts, type Actor } from './admin-policy';
import { AdminService } from './admin.service';
import type {
  AdminAccessDto,
  AdminBlockDto,
  AdminChangeRoleDto,
  AdminCreateAdminDto,
  AdminResetPasswordDto,
  AdminUpdateUserDto,
  AdminUpdateVendorDto,
} from './dto/admin.dto';

/** The request context every admin change is audited with. */
export interface AdminContext extends Actor {
  ipAddress: string | null;
}

const forbidden = (message: string) => Errors.forbidden('ADMIN_ACTION_NOT_ALLOWED', message);

/**
 * Admin changes to accounts. Each one checks `permissionsFor` (the same rules
 * the screens show), then writes the change and its audit entry in one
 * transaction. The super admin is invisible to normal admins (404).
 */
@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
    private readonly reads: AdminService,
    private readonly storage: StorageService,
    private readonly passwords: PasswordService,
    private readonly notifications: NotificationsService,
  ) {}

  async update(ctx: AdminContext, publicId: string, dto: AdminUpdateUserDto): Promise<AdminUserDetail> {
    const user = await this.requireVisible(ctx, publicId);
    if (!permissionsFor(ctx, user).editProfile) throw forbidden('You can’t edit this account');
    const profile = user.profile;
    if (!profile) throw new Error(`User ${user.id} has no profile`);

    const changes: FieldChanges = {
      ...diffFields({ email: user.email }, { email: dto.email }),
      ...diffFields(
        { username: profile.username, displayName: profile.displayName, bio: profile.bio, location: profile.location, socialLinks: profile.socialLinks },
        { username: dto.username, displayName: dto.displayName, bio: dto.bio, location: dto.location, socialLinks: dto.socialLinks },
      ),
      ...(dto.removeAvatar === true && profile.avatarKey !== null && { avatar: { from: 'photo', to: null } }),
    };
    if (Object.keys(changes).length === 0) return this.reads.getUser(ctx, publicId);

    if (changes.email) await this.assertFree('email', () => this.prisma.user.findUnique({ where: { email: dto.email } }));
    if (changes.username) await this.assertFree('username', () => this.prisma.profile.findUnique({ where: { username: dto.username } }));

    await this.withUniqueFields(() =>
      this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            // A new address has not been proven yet.
            ...(changes.email && { email: dto.email, emailVerifiedAt: null }),
            profile: {
              update: {
                ...(dto.username !== undefined && { username: dto.username }),
                ...(dto.displayName !== undefined && { displayName: dto.displayName }),
                ...(dto.bio !== undefined && { bio: dto.bio }),
                ...(dto.location !== undefined && { location: dto.location }),
                ...(dto.socialLinks !== undefined && { socialLinks: dto.socialLinks }),
                ...(changes.avatar && { avatarKey: null }),
              },
            },
          },
        });
        await this.audit.record(tx, this.entry(ctx, user.id, AuditAction.USER_UPDATED, changes, dto.reason));
      }),
    );

    if (changes.avatar && profile.avatarKey) await this.storage.delete(profile.avatarKey);
    return this.reads.getUser(ctx, publicId);
  }

  async updateVendor(ctx: AdminContext, publicId: string, dto: AdminUpdateVendorDto): Promise<AdminUserDetail> {
    const user = await this.requireVisible(ctx, publicId);
    if (!permissionsFor(ctx, user).editProfile) throw forbidden('You can’t edit this account');
    const vendor = user.vendorProfile;
    if (!vendor) throw Errors.notFound('VENDOR_NOT_FOUND', 'This user has not set up Vendor Mode');

    const removeLogo = dto.removeLogo === true && vendor.logoKey !== null;
    const changes = {
      ...diffFields(
        { isActive: vendor.isActive, businessName: vendor.businessName, description: vendor.description, website: vendor.website, socialLinks: vendor.socialLinks },
        { isActive: dto.isActive, businessName: dto.businessName, description: dto.description, website: dto.website, socialLinks: dto.socialLinks },
      ),
      ...(removeLogo && { logo: { from: 'logo', to: null } }),
    };
    if (Object.keys(changes).length === 0) return this.reads.getUser(ctx, publicId);

    await this.prisma.$transaction(async (tx) => {
      await tx.vendorProfile.update({
        where: { userId: user.id },
        data: {
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.businessName !== undefined && { businessName: dto.businessName }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.website !== undefined && { website: dto.website }),
          ...(dto.socialLinks !== undefined && { socialLinks: dto.socialLinks }),
          ...(removeLogo && { logoKey: null }),
        },
      });
      await this.audit.record(tx, this.entry(ctx, user.id, AuditAction.VENDOR_UPDATED, changes, dto.reason));
    });

    if (removeLogo && vendor.logoKey) await this.storage.delete(vendor.logoKey);
    return this.reads.getUser(ctx, publicId);
  }

  /** SUPER_ADMIN only (route): USER ↔ ADMIN. Nobody becomes SUPER_ADMIN through the API. */
  async changeRole(ctx: AdminContext, publicId: string, dto: AdminChangeRoleDto): Promise<AdminUserDetail> {
    const user = await this.requireVisible(ctx, publicId);
    if (!permissionsFor(ctx, user).changeRole) throw forbidden('You can’t change this account’s role');
    if (user.role === dto.role) return this.reads.getUser(ctx, publicId);

    const action = dto.role === 'USER' ? AuditAction.ADMIN_REMOVED : AuditAction.ADMIN_ROLE_CHANGED;
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { role: dto.role } });
      await this.audit.record(tx, this.entry(ctx, user.id, action, { role: { from: user.role, to: dto.role } }, dto.reason));
      await this.notice(tx, user.id, dto.role === 'ADMIN' ? 'You are now an admin' : 'Admin access removed',
        dto.role === 'ADMIN' ? 'You can open the admin console from your profile.' : 'Your account no longer has admin access.');
    });
    return this.reads.getUser(ctx, publicId);
  }

  /**
   * Sets a temporary password. The plaintext is hashed here and never stored,
   * logged or returned; every session of the user ends at once.
   */
  async resetPassword(ctx: AdminContext, publicId: string, dto: AdminResetPasswordDto): Promise<AdminUserDetail> {
    const user = await this.requireVisible(ctx, publicId);
    if (!permissionsFor(ctx, user).resetPassword) throw forbidden('You can’t reset this account’s password');
    const weakness = this.passwords.weaknessReason(dto.newPassword, user.email);
    if (weakness) throw Errors.badRequest('WEAK_PASSWORD', weakness);

    const requireChange = dto.requireChange ?? true;
    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: requireChange, failedLoginCount: 0, loginLockedUntil: null },
      });
      await tx.userAuthProvider.upsert({
        where: { userId_provider: { userId: user.id, provider: 'PASSWORD' } },
        create: { userId: user.id, provider: 'PASSWORD', providerUserId: user.id, providerEmail: user.email },
        update: {},
      });
      await this.revokeSessions(tx, user.id);
      // The audit entry records that a reset happened, never the password.
      await this.audit.record(tx, this.entry(ctx, user.id, AuditAction.USER_PASSWORD_RESET, { mustChangePassword: { from: user.mustChangePassword, to: requireChange } }, dto.reason));
      await this.notice(tx, user.id, 'Your password was reset', 'An admin reset your password and signed you out. Use the new password you were given.');
    });
    return this.reads.getUser(ctx, publicId);
  }

  /** Unlocks the app for an account without a store purchase (testers, promotions, support). */
  async grantAccess(ctx: AdminContext, publicId: string, dto: AdminAccessDto): Promise<AdminUserDetail> {
    const user = await this.requireVisible(ctx, publicId);
    if (!permissionsFor(ctx, user).block) throw forbidden('You can’t change this account’s access');
    if (user.paidAt) throw Errors.conflict('ALREADY_HAS_ACCESS', 'This account already has full access');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { paidAt: new Date(), paidVia: 'ADMIN' } });
      await this.audit.record(tx, this.entry(ctx, user.id, AuditAction.ACCESS_GRANTED, { access: { from: false, to: true } }, dto.reason));
      await this.notice(tx, user.id, 'Card Trader unlocked', 'An admin unlocked every feature for your account.');
    });
    return this.reads.getUser(ctx, publicId);
  }

  async revokeAccess(ctx: AdminContext, publicId: string, dto: AdminAccessDto): Promise<AdminUserDetail> {
    const user = await this.requireVisible(ctx, publicId);
    if (!permissionsFor(ctx, user).block) throw forbidden('You can’t change this account’s access');
    if (!user.paidAt) throw Errors.conflict('NO_ACCESS_TO_REVOKE', 'This account has no unlock to revoke');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { paidAt: null, paidVia: null } });
      await this.audit.record(tx, this.entry(ctx, user.id, AuditAction.ACCESS_REVOKED, { access: { from: true, to: false }, paidVia: { from: user.paidVia, to: null } }, dto.reason));
    });
    return this.reads.getUser(ctx, publicId);
  }

  async block(ctx: AdminContext, publicId: string, dto: AdminBlockDto): Promise<AdminUserDetail> {
    const user = await this.requireVisible(ctx, publicId);
    if (!permissionsFor(ctx, user).block) throw forbidden('You can’t block this account');
    if (user.status === 'BLOCKED') throw Errors.conflict('ALREADY_BLOCKED', 'This account is already blocked');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { status: 'BLOCKED', blockedAt: new Date(), blockedById: ctx.userId, blockReason: dto.reason ?? null },
      });
      await this.revokeSessions(tx, user.id);
      const action = user.role === 'ADMIN' ? AuditAction.ADMIN_DISABLED : AuditAction.USER_DISABLED;
      await this.audit.record(tx, this.entry(ctx, user.id, action, { status: { from: user.status, to: 'BLOCKED' } }, dto.reason));
    });
    return this.reads.getUser(ctx, publicId);
  }

  async unblock(ctx: AdminContext, publicId: string, dto: AdminBlockDto): Promise<AdminUserDetail> {
    const user = await this.requireVisible(ctx, publicId);
    if (!permissionsFor(ctx, user).block) throw forbidden('You can’t unblock this account');
    if (user.status === 'ACTIVE') throw Errors.conflict('NOT_BLOCKED', 'This account is not blocked');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE', blockedAt: null, blockedById: null, blockReason: null, failedLoginCount: 0, loginLockedUntil: null },
      });
      const action = user.role === 'ADMIN' ? AuditAction.ADMIN_ENABLED : AuditAction.USER_ENABLED;
      await this.audit.record(tx, this.entry(ctx, user.id, action, { status: { from: user.status, to: 'ACTIVE' } }, dto.reason));
    });
    return this.reads.getUser(ctx, publicId);
  }

  /** SUPER_ADMIN only (route): a new ADMIN account that must choose its own password. */
  async createAdmin(ctx: AdminContext, dto: AdminCreateAdminDto): Promise<AdminUserDetail> {
    const weakness = this.passwords.weaknessReason(dto.temporaryPassword, dto.email);
    if (weakness) throw Errors.badRequest('WEAK_PASSWORD', weakness);
    await this.assertFree('email', () => this.prisma.user.findUnique({ where: { email: dto.email } }));
    await this.assertFree('username', () => this.prisma.profile.findUnique({ where: { username: dto.username } }));

    const passwordHash = await this.passwords.hash(dto.temporaryPassword);
    const created = await this.withUniqueFields(() =>
      this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email,
            passwordHash,
            publicId: generatePublicId(),
            role: 'ADMIN',
            mustChangePassword: true,
            profile: { create: { username: dto.username, displayName: dto.displayName } },
          },
        });
        await tx.userAuthProvider.create({ data: { userId: user.id, provider: 'PASSWORD', providerUserId: user.id, providerEmail: dto.email } });
        await this.audit.record(tx, this.entry(ctx, user.id, AuditAction.ADMIN_CREATED, { role: { from: null, to: 'ADMIN' }, email: { from: null, to: dto.email } }, null));
        return user;
      }),
    );
    return this.reads.getUser(ctx, created.publicId);
  }

  async history(ctx: AdminContext, publicId: string): Promise<AdminAuditEntry[]> {
    const userId = await this.reads.requireUserId(ctx, publicId);
    return this.audit.history(ctx, 'USER', userId);
  }

  private async requireVisible(viewer: Actor, publicId: string) {
    const user = await this.prisma.user.findFirst({ where: { AND: [{ publicId }, visibleAccounts(viewer)] }, include: userProfileInclude });
    if (!user) throw Errors.notFound('USER_NOT_FOUND', 'User not found');
    return user;
  }

  private revokeSessions(tx: Tx, userId: string) {
    return tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private notice(tx: Tx, userId: string, title: string, body: string) {
    return this.notifications.notify(tx, { userId, type: 'ACCOUNT_SECURITY', title, body });
  }

  private entry(ctx: AdminContext, targetId: string, action: string, changes: Record<string, { from: unknown; to: unknown }>, reason: string | null | undefined) {
    return { adminId: ctx.userId, targetType: 'USER' as const, targetId, action, changes, reason, ipAddress: ctx.ipAddress };
  }

  private async assertFree(field: 'email' | 'username', find: () => Promise<unknown>): Promise<void> {
    if (await find()) throw takenError(field);
  }

  /** A concurrent signup can still take the email/username between the check and the write. */
  private async withUniqueFields<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = String((error.meta?.target as string[] | string | undefined) ?? '');
        throw takenError(target.includes('email') ? 'email' : 'username');
      }
      throw error;
    }
  }
}

function takenError(field: 'email' | 'username') {
  return field === 'email'
    ? Errors.conflict('EMAIL_TAKEN', 'Another account already uses that email')
    : Errors.conflict('USERNAME_TAKEN', 'That username is taken');
}
