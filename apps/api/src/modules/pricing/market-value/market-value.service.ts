import { Inject, Injectable } from '@nestjs/common';
import type { CardPriceHistory, PriceSource, Prisma } from '@prisma/client';
import { fallbackTierKeys, parseTierKey, type ValueConfidence } from '@card-trader/shared';
import { addDays, DAY_MS, startOfUtcDay } from '../../../common/utils/dates';
import { PrismaService } from '../../../prisma/prisma.service';
import { MARKET_VALUE_STRATEGY, type MarketEstimate, type MarketValueStrategy } from './market-value.strategy';

/** Sales whose listing matched the card with less confidence than this are stored but excluded. */
export const MIN_MATCH_CONFIDENCE = 0.7;

export type SaleWithSource = CardPriceHistory & { source: PriceSource };

export interface EstimateResult extends MarketEstimate {
  tierKeyUsed: string;
  isFallback: boolean;
}

const CONFIDENCE_ORDER: ValueConfidence[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH'];
function capConfidence(value: ValueConfidence, cap: ValueConfidence): ValueConfidence {
  return CONFIDENCE_ORDER.indexOf(value) > CONFIDENCE_ORDER.indexOf(cap) ? cap : value;
}

/**
 * Owns "what is this card worth". Comparable sales are always the same card
 * (set + number + variant) AND the same price tier; raw generic sales are the
 * only permitted fallback, for raw cards, at LOW confidence.
 */
@Injectable()
export class MarketValueService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MARKET_VALUE_STRATEGY) private readonly strategy: MarketValueStrategy,
  ) {}

  get algorithmId(): string {
    return this.strategy.id;
  }

  async recentComparableSales(
    cardId: string,
    tierKey: string,
    limit: number,
    asOf: Date = new Date(),
  ): Promise<{ sales: SaleWithSource[]; tierKeyUsed: string; isFallback: boolean }> {
    const tier = parseTierKey(tierKey);
    const candidates = [tierKey, ...(tier ? fallbackTierKeys(tier) : [])];
    for (const [index, key] of candidates.entries()) {
      const sales = await this.prisma.cardPriceHistory.findMany({
        where: this.comparableWhere(cardId, key, asOf),
        include: { source: true },
        orderBy: { soldAt: 'desc' },
        take: limit,
      });
      if (sales.length > 0) return { sales, tierKeyUsed: key, isFallback: index > 0 };
    }
    return { sales: [], tierKeyUsed: tierKey, isFallback: false };
  }

  async calculateEstimatedMarketValue(cardId: string, tierKey: string, asOf: Date = new Date()): Promise<EstimateResult> {
    const { sales, tierKeyUsed, isFallback } = await this.recentComparableSales(
      cardId,
      tierKey,
      this.strategy.sampleSize,
      asOf,
    );
    const estimate = this.strategy.estimate(sales, asOf);
    return {
      ...estimate,
      confidence: isFallback ? capConfidence(estimate.confidence, 'LOW') : estimate.confidence,
      tierKeyUsed,
      isFallback,
    };
  }

  /** Recomputes the estimate and propagates it to the daily series and collection items. */
  async recompute(cardId: string, tierKey: string, now: Date = new Date()): Promise<EstimateResult> {
    const estimate = await this.calculateEstimatedMarketValue(cardId, tierKey, now);
    const fields = {
      valueCents: estimate.valueCents,
      confidence: estimate.confidence,
      sampleSize: estimate.sampleSize,
      lastSaleAt: estimate.lastSaleAt,
      computedAt: now,
      algorithm: this.strategy.id,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.cardMarketValue.upsert({
        where: { cardId_priceTierKey: { cardId, priceTierKey: tierKey } },
        create: { cardId, priceTierKey: tierKey, ...fields },
        update: fields,
      });
      if (estimate.valueCents !== null) {
        const date = startOfUtcDay(now);
        await tx.cardMarketValueDaily.upsert({
          where: { cardId_priceTierKey_date: { cardId, priceTierKey: tierKey, date } },
          create: { cardId, priceTierKey: tierKey, date, valueCents: estimate.valueCents },
          update: { valueCents: estimate.valueCents },
        });
      }
      await tx.collectionItem.updateMany({
        where: { cardId, priceTierKey: tierKey },
        data: { estimatedValueCents: estimate.valueCents, valueUpdatedAt: now },
      });
    });
    return estimate;
  }

  /**
   * Rebuilds the daily estimate series from stored sales, e.g. after the first
   * ingestion of a card's history, so charts are meaningful immediately.
   */
  async backfillDaily(cardId: string, tierKey: string, days: number, now: Date = new Date()): Promise<number> {
    const today = startOfUtcDay(now);
    const from = addDays(today, -days);
    const windowStart = addDays(from, -this.strategy.maxAgeDays);
    const tier = parseTierKey(tierKey);
    const fallbackKey = tier ? fallbackTierKeys(tier)[0] : undefined;

    const load = (key: string) =>
      this.prisma.cardPriceHistory.findMany({
        where: this.comparableWhere(cardId, key, now, windowStart),
        select: { priceCents: true, soldAt: true },
        orderBy: { soldAt: 'desc' },
      });
    const [exact, fallback] = await Promise.all([load(tierKey), fallbackKey ? load(fallbackKey) : Promise.resolve([])]);

    const rows: Prisma.CardMarketValueDailyCreateManyInput[] = [];
    for (let date = from; date <= today; date = addDays(date, 1)) {
      const endOfDay = new Date(Math.min(date.getTime() + DAY_MS - 1, now.getTime()));
      let estimate = this.strategy.estimate(exact, endOfDay);
      if (estimate.valueCents === null && fallback.length > 0) estimate = this.strategy.estimate(fallback, endOfDay);
      if (estimate.valueCents !== null) {
        rows.push({ cardId, priceTierKey: tierKey, date, valueCents: estimate.valueCents });
      }
    }

    await this.prisma.$transaction([
      this.prisma.cardMarketValueDaily.deleteMany({ where: { cardId, priceTierKey: tierKey, date: { gte: from } } }),
      this.prisma.cardMarketValueDaily.createMany({ data: rows }),
    ]);
    return rows.length;
  }

  private comparableWhere(
    cardId: string,
    tierKey: string,
    asOf: Date,
    oldest: Date = new Date(asOf.getTime() - this.strategy.maxAgeDays * DAY_MS),
  ): Prisma.CardPriceHistoryWhereInput {
    return { cardId, priceTierKey: tierKey, isExcluded: false, soldAt: { lte: asOf, gte: oldest } };
  }
}
