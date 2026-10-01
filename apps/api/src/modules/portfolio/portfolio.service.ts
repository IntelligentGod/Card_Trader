import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CARD_CATEGORIES,
  MARKET_VALUE_DISCLAIMER,
  MOVER_WINDOW_DAYS,
  MOVER_WINDOWS,
  percentChange,
  VALUE_RANGE_DAYS,
  type CardCategory,
  type ChangeStat,
  type CollectionItemResponse,
  type Mover,
  type MoverWindow,
  type PortfolioSummary,
  type PortfolioValueHistory,
  type ValueRange,
} from '@card-trader/shared';
import { addDays, startOfUtcDay, toDateString } from '../../common/utils/dates';
import { bigintToNumber } from '../../common/utils/decimal';
import { PrismaService } from '../../prisma/prisma.service';
import { collectionItemInclude, CollectionMapper } from '../collection/collection.mapper';

interface CategoryRow {
  category: CardCategory;
  value: bigint;
  cards: number;
  items: number;
  unpriced: number;
}

interface MovementRow {
  current: bigint;
  previous: bigint;
}

interface MoverRow {
  id: string;
  current: bigint;
  previous: bigint;
  change: bigint;
}

/**
 * Collection valuation. Headline change is MARKET MOVEMENT on current holdings
 * (today's value vs the value N days ago of the same cards), so adding cards
 * never shows up as a "gain".
 */
@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: CollectionMapper,
  ) {}

  async summary(userId: string): Promise<PortfolioSummary> {
    const rows = await this.prisma.$queryRaw<CategoryRow[]>`
      SELECT c."category" AS category,
             COALESCE(SUM(ci."quantity"::bigint * ci."estimatedValueCents"), 0)::bigint AS value,
             COALESCE(SUM(ci."quantity"), 0)::int AS cards,
             COUNT(*)::int AS items,
             (COUNT(*) FILTER (WHERE ci."estimatedValueCents" IS NULL))::int AS unpriced
      FROM "CollectionItem" ci
      JOIN "Card" c ON c.id = ci."cardId"
      WHERE ci."userId" = ${userId}::uuid
      GROUP BY c."category"`;

    const byCategory = CARD_CATEGORIES.map((category) => {
      const row = rows.find((r) => r.category === category);
      return { category, valueCents: bigintToNumber(row?.value), cardCount: row?.cards ?? 0 };
    });

    const change = {} as Record<MoverWindow, ChangeStat>;
    for (const window of MOVER_WINDOWS) change[window] = await this.marketMovement(userId, MOVER_WINDOW_DAYS[window]);

    return {
      totalValueCents: byCategory.reduce((sum, c) => sum + c.valueCents, 0),
      cardCount: byCategory.reduce((sum, c) => sum + c.cardCount, 0),
      itemCount: rows.reduce((sum, r) => sum + r.items, 0),
      unpricedCount: rows.reduce((sum, r) => sum + r.unpriced, 0),
      byCategory,
      change,
      disclaimer: MARKET_VALUE_DISCLAIMER,
    };
  }

  async valueHistory(userId: string, range: ValueRange): Promise<PortfolioValueHistory> {
    const today = startOfUtcDay(new Date());
    const from = addDays(today, -VALUE_RANGE_DAYS[range]);
    const rows = await this.prisma.portfolioSnapshot.groupBy({
      by: ['date'],
      where: { userId, date: { gte: from, lt: today } },
      _sum: { valueCents: true },
      orderBy: { date: 'asc' },
    });
    const points = rows.map((r) => ({ date: toDateString(r.date), valueCents: bigintToNumber(r._sum.valueCents) }));
    // The last point is always the live value, so the chart ends where the header does.
    const live = await this.summary(userId);
    points.push({ date: toDateString(today), valueCents: live.totalValueCents });
    return { range, points };
  }

  async topCards(userId: string, limit: number): Promise<CollectionItemResponse[]> {
    const ids = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "CollectionItem"
      WHERE "userId" = ${userId}::uuid AND "estimatedValueCents" IS NOT NULL
      ORDER BY ("quantity"::bigint * "estimatedValueCents") DESC, id
      LIMIT ${limit}`;
    return this.loadInOrder(ids.map((r) => r.id));
  }

  async movers(userId: string, direction: 'up' | 'down', window: MoverWindow, limit: number): Promise<Mover[]> {
    const baseline = toDateString(addDays(startOfUtcDay(new Date()), -MOVER_WINDOW_DAYS[window]));
    const rows =
      direction === 'up'
        ? await this.prisma.$queryRaw<MoverRow[]>`
            SELECT * FROM (${this.moverSelect(userId, baseline)}) m
            WHERE m.change > 0 ORDER BY m.change DESC, m.id LIMIT ${limit}`
        : await this.prisma.$queryRaw<MoverRow[]>`
            SELECT * FROM (${this.moverSelect(userId, baseline)}) m
            WHERE m.change < 0 ORDER BY m.change ASC, m.id LIMIT ${limit}`;

    const items = await this.loadInOrder(rows.map((r) => r.id));
    return rows.flatMap((row, index) => {
      const item = items[index];
      if (!item) return [];
      const previous = bigintToNumber(row.previous);
      const current = bigintToNumber(row.current);
      return [{ item, previousValueCents: previous, currentValueCents: current, changeCents: current - previous, percent: percentChange(current, previous) }];
    });
  }

  /** Per-item value now vs the latest daily estimate on/before the baseline date. */
  private moverSelect(userId: string, baseline: string): Prisma.Sql {
    return Prisma.sql`
      SELECT ci.id,
             (ci."quantity"::bigint * ci."estimatedValueCents") AS current,
             (ci."quantity"::bigint * prev."valueCents") AS previous,
             (ci."quantity"::bigint * (ci."estimatedValueCents" - prev."valueCents")) AS change
      FROM "CollectionItem" ci
      JOIN LATERAL (
        SELECT d."valueCents" FROM "CardMarketValueDaily" d
        WHERE d."cardId" = ci."cardId" AND d."priceTierKey" = ci."priceTierKey" AND d."date" <= ${baseline}::date
        ORDER BY d."date" DESC LIMIT 1
      ) prev ON true
      WHERE ci."userId" = ${userId}::uuid AND ci."estimatedValueCents" IS NOT NULL`;
  }

  private async marketMovement(userId: string, days: number): Promise<ChangeStat> {
    const baseline = toDateString(addDays(startOfUtcDay(new Date()), -days));
    const [row] = await this.prisma.$queryRaw<MovementRow[]>`
      SELECT COALESCE(SUM(ci."quantity"::bigint * ci."estimatedValueCents"), 0)::bigint AS current,
             COALESCE(SUM(ci."quantity"::bigint * prev."valueCents"), 0)::bigint AS previous
      FROM "CollectionItem" ci
      JOIN LATERAL (
        SELECT d."valueCents" FROM "CardMarketValueDaily" d
        WHERE d."cardId" = ci."cardId" AND d."priceTierKey" = ci."priceTierKey" AND d."date" <= ${baseline}::date
        ORDER BY d."date" DESC LIMIT 1
      ) prev ON true
      WHERE ci."userId" = ${userId}::uuid AND ci."estimatedValueCents" IS NOT NULL`;
    const current = bigintToNumber(row?.current);
    const previous = bigintToNumber(row?.previous);
    return { amountCents: current - previous, percent: percentChange(current, previous) };
  }

  private async loadInOrder(ids: string[]): Promise<CollectionItemResponse[]> {
    if (ids.length === 0) return [];
    const items = await this.prisma.collectionItem.findMany({ where: { id: { in: ids } }, include: collectionItemInclude });
    const byId = new Map(items.map((i) => [i.id, i]));
    return ids.flatMap((id) => {
      const item = byId.get(id);
      return item ? [this.mapper.toResponse(item)] : [];
    });
  }
}
