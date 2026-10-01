import { Injectable } from '@nestjs/common';
import {
  CARD_CATEGORIES,
  CatalogSource,
  GRADING_COMPANIES,
  LISTING_STATUSES,
  TRADE_STATUSES,
  UserRole,
  UserStatus,
  type AdminAnalytics,
  type CardCategory,
} from '@card-trader/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { visibleAccounts, type Actor } from './admin-policy';

const MONTHS = 12;
const TOP_CARDS = 10;

/** The last `count` months as YYYY-MM (UTC), oldest first, ending with the month of `now`. */
export function lastMonths(now: Date, count: number): string[] {
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

/** Every key present, missing groups as 0, so charts keep a stable slot per entity. */
export function countsByKey<K extends string>(keys: readonly K[], rows: { key: string | null; count: number }[]): Record<K, number> {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const row of rows) if (row.key !== null && row.key in out) out[row.key as K] += row.count;
  return out;
}

type MonthRow = { month: string; count: bigint; value?: bigint | null };

/** Whole-app numbers for the analytics page. Read-only. */
@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async analytics(viewer: Actor, now: Date = new Date()): Promise<AdminAnalytics> {
    const visible = visibleAccounts(viewer);
    const hideSuper = viewer.role !== 'SUPER_ADMIN';
    const roles = Object.values(UserRole).filter((r) => !hideSuper || r !== 'SUPER_ADMIN');
    const months = lastMonths(now, MONTHS);
    const since = new Date(`${months[0]}-01T00:00:00.000Z`);

    const [
      usersByStatus,
      usersByRole,
      vendors,
      signups,
      collectionByCategory,
      byListing,
      graded,
      byGrader,
      catalogTotal,
      catalogVerified,
      catalogByCategory,
      catalogBySource,
      tradesByStatus,
      completedByMonth,
      completedAll,
      topCards,
    ] = await Promise.all([
      this.prisma.user.groupBy({ by: ['status'], where: visible, _count: { _all: true } }),
      this.prisma.user.groupBy({ by: ['role'], where: visible, _count: { _all: true } }),
      this.prisma.vendorProfile.count({ where: { isActive: true } }),
      this.prisma.$queryRaw<MonthRow[]>`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month, COUNT(*) AS count
        FROM "User" WHERE "createdAt" >= ${since} ${hideSuper ? Prisma.sql`AND "role" <> 'SUPER_ADMIN'` : Prisma.empty} GROUP BY 1`,
      this.prisma.$queryRaw<{ category: CardCategory; items: bigint; cards: bigint | null; value: bigint | null }[]>`
        SELECT c."category" AS category, COUNT(*) AS items, SUM(ci."quantity") AS cards,
               SUM(COALESCE(ci."estimatedValueCents", 0)::bigint * ci."quantity") AS value
        FROM "CollectionItem" ci JOIN "Card" c ON c."id" = ci."cardId" GROUP BY c."category"`,
      this.prisma.collectionItem.groupBy({ by: ['listingStatus'], _count: { _all: true } }),
      this.prisma.collectionItem.count({ where: { condition: 'GRADED' } }),
      this.prisma.collectionItem.groupBy({ by: ['gradingCompany'], where: { condition: 'GRADED' }, _count: { _all: true } }),
      this.prisma.card.count(),
      this.prisma.card.count({ where: { isVerified: true } }),
      this.prisma.card.groupBy({ by: ['category'], _count: { _all: true } }),
      this.prisma.card.groupBy({ by: ['source'], _count: { _all: true } }),
      this.prisma.trade.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.$queryRaw<MonthRow[]>`
        SELECT to_char(date_trunc('month', t."completedAt"), 'YYYY-MM') AS month,
               COUNT(DISTINCT t."id") AS count, SUM(p."itemsTotalCents")::bigint AS value
        FROM "Trade" t JOIN "TradeParticipant" p ON p."tradeId" = t."id"
        WHERE t."status" = 'COMPLETED' AND t."completedAt" >= ${since} GROUP BY 1`,
      this.prisma.$queryRaw<{ count: bigint; value: bigint | null }[]>`
        SELECT COUNT(DISTINCT t."id") AS count, SUM(p."itemsTotalCents")::bigint AS value
        FROM "Trade" t JOIN "TradeParticipant" p ON p."tradeId" = t."id" WHERE t."status" = 'COMPLETED'`,
      this.prisma.$queryRaw<{ cardId: string; name: string; setName: string; category: CardCategory; copies: bigint; value: bigint }[]>`
        SELECT c."id" AS "cardId", c."name" AS name, s."name" AS "setName", c."category" AS category,
               SUM(ci."quantity") AS copies, SUM(COALESCE(ci."estimatedValueCents", 0)::bigint * ci."quantity") AS value
        FROM "CollectionItem" ci JOIN "Card" c ON c."id" = ci."cardId" JOIN "CardSet" s ON s."id" = c."setId"
        GROUP BY c."id", s."name" HAVING SUM(COALESCE(ci."estimatedValueCents", 0)) > 0
        ORDER BY value DESC LIMIT ${TOP_CARDS}`,
    ]);

    const signupByMonth = new Map(signups.map((r) => [r.month, Number(r.count)]));
    const completedMonth = new Map(completedByMonth.map((r) => [r.month, r]));
    const completedCount = Number(completedAll[0]?.count ?? 0);
    const totalItems = byListing.reduce((sum, g) => sum + g._count._all, 0);

    return {
      users: {
        byStatus: countsByKey(Object.values(UserStatus), usersByStatus.map((g) => ({ key: g.status, count: g._count._all }))),
        byRole: countsByKey(roles, usersByRole.map((g) => ({ key: g.role, count: g._count._all }))),
        vendors,
        signupsByMonth: months.map((month) => ({ month, count: signupByMonth.get(month) ?? 0 })),
      },
      collection: {
        byCategory: CARD_CATEGORIES.map((category) => {
          const row = collectionByCategory.find((r) => r.category === category);
          return { category, items: Number(row?.items ?? 0), cards: Number(row?.cards ?? 0), valueCents: Number(row?.value ?? 0) };
        }),
        byListingStatus: countsByKey(LISTING_STATUSES, byListing.map((g) => ({ key: g.listingStatus, count: g._count._all }))),
        rawItems: totalItems - graded,
        gradedItems: graded,
        byGrader: countsByKey(GRADING_COMPANIES, byGrader.map((g) => ({ key: g.gradingCompany, count: g._count._all }))),
      },
      catalog: {
        total: catalogTotal,
        verified: catalogVerified,
        unverified: catalogTotal - catalogVerified,
        byCategory: countsByKey(CARD_CATEGORIES, catalogByCategory.map((g) => ({ key: g.category, count: g._count._all }))),
        bySource: countsByKey(Object.values(CatalogSource), catalogBySource.map((g) => ({ key: g.source, count: g._count._all }))),
      },
      trades: {
        byStatus: countsByKey(TRADE_STATUSES, tradesByStatus.map((g) => ({ key: g.status, count: g._count._all }))),
        completedByMonth: months.map((month) => {
          const row = completedMonth.get(month);
          return { month, count: Number(row?.count ?? 0), valueCents: Number(row?.value ?? 0) };
        }),
        averageCompletedValueCents: completedCount > 0 ? Math.round(Number(completedAll[0]?.value ?? 0) / completedCount) : null,
      },
      topCards: topCards.map((c) => ({
        cardId: c.cardId,
        name: c.name,
        setName: c.setName,
        category: c.category,
        copies: Number(c.copies),
        valueCents: Number(c.value),
      })),
      generatedAt: now.toISOString(),
    };
  }
}
