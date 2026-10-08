import { Injectable } from '@nestjs/common';
import type { AuthProviderType, Profile, User, VendorProfile } from '@prisma/client';
import type {
  MeResponse,
  ProfileStats,
  PublicProfile,
  PublicUserLite,
  PublicVendorInfo,
  VendorProfileResponse,
} from '@card-trader/shared';
import { hasFullAccess } from '../../common/auth/full-access';
import { readSocialLinks } from '../../common/validation/social-links';
import { AppConfig } from '../../config/app-config.service';
import { StorageService } from '../uploads/storage.service';

/** Relations every user-facing query loads. */
export const userProfileInclude = {
  profile: true,
  vendorProfile: true,
  authProviders: { select: { provider: true } },
} as const;
/** Select for embedding another user (trade partner, reviewer, vendor). */
export const publicUserSelect = { publicId: true, profile: true, vendorProfile: true } as const;

export type UserWithProfile = User & {
  profile: Profile | null;
  vendorProfile: VendorProfile | null;
  authProviders: { provider: AuthProviderType }[];
};
export type PublicUserSource = { publicId: string; profile: Profile | null; vendorProfile: VendorProfile | null };

/**
 * The ONLY place user rows become API responses. Public shapes never include
 * email, internal ids, password hashes, or token data.
 */
@Injectable()
export class UserMapper {
  constructor(private readonly config: AppConfig, private readonly storage: StorageService) {}

  stats(profile: Profile | null): ProfileStats {
    const count = profile?.ratingCount ?? 0;
    return {
      ratingAverage: count > 0 ? Math.round(((profile?.ratingSum ?? 0) / count) * 10) / 10 : null,
      ratingCount: count,
      completedTradeCount: profile?.completedTradeCount ?? 0,
    };
  }

  toMe(user: UserWithProfile): MeResponse {
    return {
      publicId: user.publicId,
      email: user.email,
      role: user.role,
      username: user.profile?.username ?? '',
      displayName: user.profile?.displayName ?? 'Collector',
      bio: user.profile?.bio ?? null,
      avatarUrl: this.storage.urlFor(user.profile?.avatarKey),
      location: user.profile?.location ?? null,
      socialLinks: readSocialLinks(user.profile?.socialLinks),
      vendor: user.vendorProfile ? this.toVendor(user.vendorProfile) : null,
      stats: this.stats(user.profile),
      emailVerified: user.emailVerifiedAt !== null,
      twoFactorEnabled: user.twoFactorEnabled,
      mustChangePassword: user.mustChangePassword,
      hasPassword: user.passwordHash !== null,
      authProviders: user.authProviders.map((p) => p.provider),
      hasFullAccess: hasFullAccess(user, this.config.get('PAYWALL_ENABLED')),
      createdAt: user.createdAt.toISOString(),
    };
  }

  toVendor(vendor: VendorProfile): VendorProfileResponse {
    return {
      isActive: vendor.isActive,
      businessName: vendor.businessName,
      logoUrl: this.storage.urlFor(vendor.logoKey),
      logoKey: vendor.logoKey,
      description: vendor.description,
      website: vendor.website,
      socialLinks: readSocialLinks(vendor.socialLinks),
    };
  }

  /** Vendor details are public only while Vendor Mode is on. */
  toPublicVendor(vendor: VendorProfile | null): PublicVendorInfo | null {
    if (!vendor?.isActive) return null;
    return {
      businessName: vendor.businessName,
      logoUrl: this.storage.urlFor(vendor.logoKey),
      description: vendor.description,
      website: vendor.website,
      socialLinks: readSocialLinks(vendor.socialLinks),
    };
  }

  toLite(user: PublicUserSource): PublicUserLite {
    const stats = this.stats(user.profile);
    return {
      publicId: user.publicId,
      username: user.profile?.username ?? '',
      displayName: user.profile?.displayName ?? 'Collector',
      avatarUrl: this.storage.urlFor(user.profile?.avatarKey),
      ratingAverage: stats.ratingAverage,
      completedTradeCount: stats.completedTradeCount,
      vendorName: user.vendorProfile?.isActive ? user.vendorProfile.businessName : null,
    };
  }

  toPublic(user: UserWithProfile, counts: { forTrade: number; forSale: number; available: number }): PublicProfile {
    return {
      publicId: user.publicId,
      username: user.profile?.username ?? '',
      displayName: user.profile?.displayName ?? 'Collector',
      bio: user.profile?.bio ?? null,
      avatarUrl: this.storage.urlFor(user.profile?.avatarKey),
      location: user.profile?.location ?? null,
      socialLinks: readSocialLinks(user.profile?.socialLinks),
      vendor: this.toPublicVendor(user.vendorProfile),
      stats: this.stats(user.profile),
      memberSince: user.createdAt.toISOString(),
      availableCount: counts.available,
      forTradeCount: counts.forTrade,
      forSaleCount: counts.forSale,
    };
  }
}
