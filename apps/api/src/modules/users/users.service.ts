import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isValidPublicId, buildUserDeepLink } from '@card-trader/shared';
import type { MeResponse, PublicProfile, QrPayload } from '@card-trader/shared';
import { Errors } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { usernameTaken } from '../auth/auth.service';
import { StorageService } from '../uploads/storage.service';
import type { UpdateMeDto, UpsertVendorProfileDto } from './dto/users.dto';
import { UserMapper, userProfileInclude, type UserWithProfile } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: UserMapper,
    private readonly storage: StorageService,
  ) {}

  async getMe(userId: string): Promise<MeResponse> {
    return this.mapper.toMe(await this.requireActive(userId));
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<MeResponse> {
    const user = await this.requireActive(userId);
    if (dto.avatarKey && !this.storage.isOwnedKey(dto.avatarKey, 'AVATAR', userId)) {
      throw Errors.badRequest('INVALID_AVATAR_KEY', 'Upload the avatar first and use the returned key');
    }
    if (dto.username !== undefined && dto.username !== user.profile?.username) {
      const taken = await this.prisma.profile.findUnique({ where: { username: dto.username }, select: { userId: true } });
      if (taken) throw usernameTaken();
    }
    const previousAvatar = user.profile?.avatarKey ?? null;

    const updated = await this.withUniqueUsername(() =>
      this.prisma.user.update({
        where: { id: userId },
        data: {
          profile: {
            update: {
              ...(dto.username !== undefined && { username: dto.username }),
              ...(dto.displayName !== undefined && { displayName: dto.displayName }),
              ...(dto.bio !== undefined && { bio: dto.bio }),
              ...(dto.avatarKey !== undefined && { avatarKey: dto.avatarKey }),
              ...(dto.location !== undefined && { location: dto.location }),
              ...(dto.socialLinks !== undefined && { socialLinks: dto.socialLinks }),
            },
          },
        },
        include: userProfileInclude,
      }),
    );

    if (dto.avatarKey !== undefined && previousAvatar && previousAvatar !== dto.avatarKey) {
      await this.storage.delete(previousAvatar);
    }
    return this.mapper.toMe(updated);
  }

  /**
   * Turns Vendor Mode on/off and edits the business details. The account,
   * inventory, reviews and trade history are the same in both modes.
   */
  async upsertVendor(userId: string, dto: UpsertVendorProfileDto): Promise<MeResponse> {
    const user = await this.requireActive(userId);
    if (dto.logoKey && !this.storage.isOwnedKey(dto.logoKey, 'VENDOR_LOGO', userId)) {
      throw Errors.badRequest('INVALID_LOGO_KEY', 'Upload the logo first and use the returned key');
    }
    const previousLogo = user.vendorProfile?.logoKey ?? null;
    const fields = {
      isActive: dto.isActive,
      businessName: dto.businessName,
      ...(dto.logoKey !== undefined && { logoKey: dto.logoKey }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.website !== undefined && { website: dto.website }),
      ...(dto.socialLinks !== undefined && { socialLinks: dto.socialLinks }),
    };
    await this.prisma.vendorProfile.upsert({
      where: { userId },
      create: { userId, ...fields },
      update: fields,
    });
    if (dto.logoKey !== undefined && previousLogo && previousLogo !== dto.logoKey) {
      await this.storage.delete(previousLogo);
    }
    return this.getMe(userId);
  }

  async getQr(userId: string): Promise<QrPayload> {
    const user = await this.requireActive(userId);
    return { publicId: user.publicId, deepLink: buildUserDeepLink(user.publicId) };
  }

  async getPublicProfile(publicId: string): Promise<PublicProfile> {
    const user = await this.findActiveByPublicId(publicId);
    const groups = await this.prisma.collectionItem.groupBy({
      by: ['listingStatus'],
      where: { userId: user.id, listingStatus: { not: 'PERSONAL' } },
      _count: { _all: true },
    });
    const count = (status: string) => groups.find((g) => g.listingStatus === status)?._count._all ?? 0;
    const forTrade = count('FOR_TRADE');
    const forSale = count('FOR_SALE');
    const both = count('TRADE_AND_SALE');
    return this.mapper.toPublic(user, {
      forTrade: forTrade + both,
      forSale: forSale + both,
      available: forTrade + forSale + both,
    });
  }

  /** Resolves a public id to an active user. Unknown/inactive → 404 (no enumeration hints). */
  async findActiveByPublicId(publicId: string): Promise<UserWithProfile> {
    if (!isValidPublicId(publicId)) throw Errors.notFound('USER_NOT_FOUND', 'User not found');
    const user = await this.prisma.user.findUnique({ where: { publicId }, include: userProfileInclude });
    if (!user || user.status !== 'ACTIVE') throw Errors.notFound('USER_NOT_FOUND', 'User not found');
    return user;
  }

  async requireActive(userId: string): Promise<UserWithProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: userProfileInclude });
    if (!user || user.status !== 'ACTIVE') throw Errors.unauthorized('ACCOUNT_INACTIVE', 'Account is not active');
    return user;
  }

  /** The pre-check gives a friendly error; this covers the race between two sign-ups. */
  private async withUniqueUsername<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw usernameTaken();
      throw error;
    }
  }
}
