import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ACTIVE_TRADE_STATUSES,
  TRADE_STATUSES,
  type AdminOverview,
  type AdminReview,
  type AdminTradeDetail,
  type AdminTradeListItem,
  type AdminUserDetail,
  type AdminUserEvent,
  type AdminUserListItem,
  type AdminUserReviews,
  type CollectionItemResponse,
  type Paginated,
  type PaidVia,
  type TradeStatus,
} from '@card-trader/shared';
import { hasFullAccess } from '../../common/auth/full-access';
import { Errors } from '../../common/errors/app.exception';
import { pageArgs, toPage, type CursorQueryDto } from '../../common/pagination/pagination';
import { readSocialLinks } from '../../common/validation/social-links';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { collectionItemInclude, CollectionMapper } from '../collection/collection.mapper';
import { adminTradeListInclude, tradeDetailInclude, TradeMapper } from '../trades/trade.mapper';
import { StorageService } from '../uploads/storage.service';
import { publicUserSelect, UserMapper, userProfileInclude } from '../users/user.mapper';
import { permissionsFor, visibleAccounts, type Actor } from './admin-policy';
import type { AdminTradeListQueryDto, AdminUserListQueryDto } from './dto/admin.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Per-user event list in the detail view; the console is a lookup tool, not a report. */
const USER_EVENT_LIMIT = 50;
const USER_REVIEW_LIMIT = 100;

const reviewInclude = {
  reviewer: { select: publicUserSelect },
  reviewedUser: { select: publicUserSelect },
} satisfies Prisma.ReviewInclude;

/** Read-only queries for the admin console. Nothing here changes data. */
@Injectable()
export class AdminService {
  constructor(
    private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly users: UserMapper,
    private readonly trades: TradeMapper,
    private readonly collection: CollectionMapper,
    private readonly storage: StorageService,
  ) {}

  async overview(viewer: Actor, now: Date = new Date()): Promise<AdminOverview> {
    const visible = visibleAccounts(viewer);
    const [userGroups, admins, vendors, newUsers, items, value, tradeGroups, eventGroups, upcoming, reviews] =
      await Promise.all([
        this.prisma.user.groupBy({ by: ['status'], where: visible, _count: { _all: true } }),
        this.prisma.user.count({ where: { AND: [visible, { role: { in: ['ADMIN', 'SUPER_ADMIN'] } }] } }),
        this.prisma.vendorProfile.count({ where: { isActive: true } }),
        this.prisma.user.count({ where: { AND: [visible, { createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } }] } }),
        this.prisma.collectionItem.aggregate({ _count: { _all: true }, _sum: { quantity: true } }),
        this.prisma.$queryRaw<{ total: bigint | null }[]>`
          SELECT SUM("estimatedValueCents"::bigint * "quantity") AS total FROM "CollectionItem"`,
        this.prisma.trade.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.event.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.event.count({ where: { status: 'PUBLISHED', endsAt: { gte: now } } }),
        this.prisma.review.aggregate({ _count: { _all: true }, _avg: { rating: true } }),
      ]);

    const usersBy = (status: string) => userGroups.find((g) => g.status === status)?._count._all ?? 0;
    const byStatus = Object.fromEntries(
      TRADE_STATUSES.map((s) => [s, tradeGroups.find((g) => g.status === s)?._count._all ?? 0]),
    ) as Record<TradeStatus, number>;
    const avg = reviews._avg.rating;

    return {
      users: {
        total: userGroups.reduce((sum, g) => sum + g._count._all, 0),
        active: usersBy('ACTIVE'),
        blocked: usersBy('BLOCKED'),
        admins,
        vendors,
        newLast7Days: newUsers,
      },
      collection: {
        items: items._count._all,
        cards: items._sum.quantity ?? 0,
        totalValueCents: Number(value[0]?.total ?? 0),
      },
      trades: { total: tradeGroups.reduce((sum, g) => sum + g._count._all, 0), byStatus },
      events: {
        total: eventGroups.reduce((sum, g) => sum + g._count._all, 0),
        published: eventGroups.find((g) => g.status === 'PUBLISHED')?._count._all ?? 0,
        upcoming,
      },
      reviews: { total: reviews._count._all, averageRating: avg === null ? null : Math.round(avg * 10) / 10 },
    };
  }

  async listUsers(viewer: Actor, query: AdminUserListQueryDto): Promise<Paginated<AdminUserListItem>> {
    const q = query.q?.trim();
    const rows = await this.prisma.user.findMany({
      where: {
        AND: [visibleAccounts(viewer)],
        ...(query.role && { role: query.role }),
        ...(query.status && { status: query.status }),
        ...(q && {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { profile: { username: { contains: q.replace(/^@/, ''), mode: 'insensitive' } } },
            { profile: { displayName: { contains: q, mode: 'insensitive' } } },
            { vendorProfile: { businessName: { contains: q, mode: 'insensitive' } } },
          ],
        }),
      },
      include: { ...userProfileInclude, _count: { select: { collectionItems: true, tradeParticipations: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageArgs(query),
    });
    return toPage(rows, query, (user) => ({
      publicId: user.publicId,
      email: user.email,
      username: user.profile?.username ?? '',
      displayName: user.profile?.displayName ?? 'Collector',
      avatarUrl: this.storage.urlFor(user.profile?.avatarKey),
      role: user.role,
      status: user.status,
      vendor: user.vendorProfile
        ? { businessName: user.vendorProfile.businessName, isActive: user.vendorProfile.isActive }
        : null,
      collectionCount: user._count.collectionItems,
      tradeCount: user._count.tradeParticipations,
      emailVerified: user.emailVerifiedAt !== null,
      twoFactorEnabled: user.twoFactorEnabled,
      hasFullAccess: hasFullAccess(user, this.config.get('PAYWALL_ENABLED')),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    }));
  }

  async getUser(viewer: Actor, publicId: string): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findFirst({ where: { AND: [{ publicId }, visibleAccounts(viewer)] }, include: userProfileInclude });
    if (!user) throw userNotFound();

    const [items, trades, activeTrades, reviewsReceived, reviewsWritten, lastToken, organized, vendorRows, saves] =
      await Promise.all([
        this.prisma.collectionItem.findMany({
          where: { userId: user.id },
          select: { quantity: true, estimatedValueCents: true },
        }),
        this.prisma.tradeParticipant.count({ where: { userId: user.id } }),
        this.prisma.tradeParticipant.count({
          where: { userId: user.id, trade: { status: { in: [...ACTIVE_TRADE_STATUSES] } } },
        }),
        this.prisma.review.count({ where: { reviewedUserId: user.id } }),
        this.prisma.review.count({ where: { reviewerId: user.id } }),
        this.prisma.refreshToken.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
        this.prisma.event.findMany({
          where: { organizerId: user.id },
          orderBy: { startsAt: 'desc' },
          take: USER_EVENT_LIMIT,
          select: { id: true, title: true, status: true, startsAt: true },
        }),
        this.prisma.eventVendor.findMany({
          where: { vendorId: user.id },
          orderBy: { event: { startsAt: 'desc' } },
          take: USER_EVENT_LIMIT,
          select: { status: true, tableNumber: true, event: { select: { id: true, title: true, status: true, startsAt: true } } },
        }),
        this.prisma.eventSave.findMany({
          where: { userId: user.id },
          orderBy: { event: { startsAt: 'desc' } },
          take: USER_EVENT_LIMIT,
          select: { event: { select: { id: true, title: true, status: true, startsAt: true } } },
        }),
      ]);

    const toEvent = (
      event: { id: string; title: string; status: AdminUserEvent['status']; startsAt: Date },
      relation: AdminUserEvent['relation'],
      vendor?: { status: AdminUserEvent['vendorStatus']; tableNumber: string | null },
    ): AdminUserEvent => ({
      id: event.id,
      title: event.title,
      status: event.status,
      startsAt: event.startsAt.toISOString(),
      relation,
      vendorStatus: vendor?.status ?? null,
      tableNumber: vendor?.tableNumber ?? null,
    });
    const events = [
      ...organized.map((e) => toEvent(e, 'ORGANIZER')),
      ...vendorRows.map((v) => toEvent(v.event, 'VENDOR', v)),
      ...saves.map((s) => toEvent(s.event, 'SAVED')),
    ].sort((a, b) => b.startsAt.localeCompare(a.startsAt));

    return {
      publicId: user.publicId,
      email: user.email,
      role: user.role,
      status: user.status,
      username: user.profile?.username ?? '',
      displayName: user.profile?.displayName ?? 'Collector',
      bio: user.profile?.bio ?? null,
      avatarUrl: this.storage.urlFor(user.profile?.avatarKey),
      location: user.profile?.location ?? null,
      socialLinks: readSocialLinks(user.profile?.socialLinks),
      vendor: user.vendorProfile ? this.users.toVendor(user.vendorProfile) : null,
      stats: this.users.stats(user.profile),
      counts: {
        collectionItems: items.length,
        cards: items.reduce((sum, i) => sum + i.quantity, 0),
        trades,
        activeTrades,
        reviewsReceived,
        reviewsWritten,
      },
      collectionValueCents: items.reduce((sum, i) => sum + (i.estimatedValueCents ?? 0) * i.quantity, 0),
      events,
      lastActiveAt: lastToken?.createdAt.toISOString() ?? null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      emailVerified: user.emailVerifiedAt !== null,
      twoFactorEnabled: user.twoFactorEnabled,
      mustChangePassword: user.mustChangePassword,
      hasPassword: user.passwordHash !== null,
      authProviders: user.authProviders.map((p) => p.provider),
      blockedAt: user.blockedAt?.toISOString() ?? null,
      blockReason: user.blockReason,
      hasFullAccess: hasFullAccess(user, this.config.get('PAYWALL_ENABLED')),
      paidAt: user.paidAt?.toISOString() ?? null,
      paidVia: (user.paidVia as PaidVia | null) ?? null,
      permissions: permissionsFor(viewer, user),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  /** Every item, including PERSONAL ones the public never sees. */
  async userCollection(viewer: Actor, publicId: string, query: CursorQueryDto): Promise<Paginated<CollectionItemResponse>> {
    const userId = await this.requireUserId(viewer, publicId);
    const rows = await this.prisma.collectionItem.findMany({
      where: { userId },
      include: collectionItemInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageArgs(query),
    });
    return toPage(rows, query, (row) => this.collection.toResponse(row));
  }

  async userTrades(viewer: Actor, publicId: string, query: CursorQueryDto): Promise<Paginated<AdminTradeListItem>> {
    const userId = await this.requireUserId(viewer, publicId);
    return this.tradePage({ participants: { some: { userId } } }, query);
  }

  async userReviews(viewer: Actor, publicId: string): Promise<AdminUserReviews> {
    const userId = await this.requireUserId(viewer, publicId);
    const [received, written] = await Promise.all([
      this.prisma.review.findMany({
        where: { reviewedUserId: userId },
        include: reviewInclude,
        orderBy: { createdAt: 'desc' },
        take: USER_REVIEW_LIMIT,
      }),
      this.prisma.review.findMany({
        where: { reviewerId: userId },
        include: reviewInclude,
        orderBy: { createdAt: 'desc' },
        take: USER_REVIEW_LIMIT,
      }),
    ]);
    const toAdmin = (r: (typeof received)[number]): AdminReview => ({
      ...this.trades.toReview(r),
      subject: this.users.toLite(r.reviewedUser),
    });
    return { received: received.map(toAdmin), written: written.map(toAdmin) };
  }

  listTrades(query: AdminTradeListQueryDto): Promise<Paginated<AdminTradeListItem>> {
    return this.tradePage(query.status ? { status: query.status } : {}, query);
  }

  async getTrade(id: string): Promise<AdminTradeDetail> {
    const trade = await this.prisma.trade.findUnique({ where: { id }, include: tradeDetailInclude });
    if (!trade) throw Errors.notFound('TRADE_NOT_FOUND', 'Trade not found');
    return this.trades.toAdminDetail(trade);
  }

  private async tradePage(where: Prisma.TradeWhereInput, query: CursorQueryDto): Promise<Paginated<AdminTradeListItem>> {
    const rows = await this.prisma.trade.findMany({
      where,
      include: adminTradeListInclude,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      ...pageArgs(query),
    });
    return toPage(rows, query, (row) => this.trades.toAdminListItem(row));
  }

  /** 404 for unknown ids and for the super admin when a normal admin asks. */
  async requireUserId(viewer: Actor, publicId: string): Promise<string> {
    const user = await this.prisma.user.findFirst({ where: { AND: [{ publicId }, visibleAccounts(viewer)] }, select: { id: true } });
    if (!user) throw userNotFound();
    return user.id;
  }
}

const userNotFound = () => Errors.notFound('USER_NOT_FOUND', 'User not found');
