import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ACTIVE_TRADE_STATUSES, parseTierKey, tierKey, type PriceTier } from '@card-trader/shared';
import { addDays } from '../../../common/utils/dates';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { MarketValueService, MIN_MATCH_CONFIDENCE } from '../market-value/market-value.service';
import { REFRESH_PRIORITY } from '../price-tracking.service';
import { PRICE_PROVIDERS, type NormalizedSale, type PriceProvider, type PricingTarget } from '../providers/price-provider.interface';
import { ProviderRateLimitedError } from '../providers/rate-limiter';

const HISTORY_DAYS = 365;
const LEASE_MINUTES = 10;
const HOUR_MS = 60 * 60 * 1000;
const REFRESH_INTERVAL_MS: Record<number, number> = {
  [REFRESH_PRIORITY.IN_TRADE]: 6 * HOUR_MS,
  [REFRESH_PRIORITY.COLLECTED]: 24 * HOUR_MS,
  [REFRESH_PRIORITY.IDLE]: 7 * 24 * HOUR_MS,
};

interface ClaimedRow {
  id: string;
  cardId: string;
  priceTierKey: string;
}

/**
 * Background refresh pipeline:
 *   claim due rows (lease, SKIP LOCKED) → fetch sales from each enabled provider
 *   → normalize + store CardPriceHistory (idempotent) → recompute estimate
 *   → propagate to daily series + collection items → schedule next refresh.
 */
@Injectable()
export class PriceRefreshService implements OnModuleInit {
  private readonly logger = new Logger(PriceRefreshService.name);
  private readonly sourceIds = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketValue: MarketValueService,
    private readonly config: AppConfig,
    @Inject(PRICE_PROVIDERS) private readonly providers: PriceProvider[],
  ) {}

  async onModuleInit(): Promise<void> {
    for (const provider of this.providers) {
      const source = await this.prisma.priceSource.upsert({
        where: { code: provider.code },
        create: { code: provider.code, name: provider.displayName, isEnabled: true },
        update: { name: provider.displayName, isEnabled: true },
      });
      this.sourceIds.set(provider.code, source.id);
    }
    this.logger.log(`Pricing providers enabled: ${this.providers.map((p) => p.code).join(', ') || 'none'}`);
  }

  /** Processes one batch of due card+tier rows. Returns how many were processed. */
  async runBatch(): Promise<number> {
    if (this.providers.length === 0) return 0;
    const claimed = await this.claimDue(this.config.get('PRICE_REFRESH_BATCH_SIZE'));
    for (const row of claimed) {
      try {
        await this.refreshOne(row);
      } catch (error) {
        this.logger.error(`Refresh failed for ${row.cardId}/${row.priceTierKey}: ${String(error)}`);
        await this.recordFailure(row.id, null);
      }
    }
    return claimed.length;
  }

  async refreshOne(row: ClaimedRow): Promise<void> {
    const value = await this.prisma.cardMarketValue.findUnique({
      where: { id: row.id },
      include: { card: { include: { set: true } } },
    });
    const tier = value ? parseTierKey(value.priceTierKey) : null;
    if (!value || !tier) {
      this.logger.warn(`Skipping unknown tier ${row.priceTierKey}`);
      await this.prisma.cardMarketValue.updateMany({
        where: { id: row.id },
        data: { lockedUntil: null, nextRefreshAt: addDays(new Date(), 30) },
      });
      return;
    }

    const now = new Date();
    const isFirstRefresh = value.computedAt === null;
    const historyStart = addDays(now, -HISTORY_DAYS);
    const since =
      isFirstRefresh || !value.lastSaleAt
        ? historyStart
        : new Date(Math.max(addDays(value.lastSaleAt, -2).getTime(), historyStart.getTime()));

    const target: PricingTarget = {
      cardId: value.cardId,
      category: value.card.category,
      name: value.card.name,
      setName: value.card.set.name,
      setCode: value.card.set.code,
      year: value.card.set.year,
      cardNumber: value.card.cardNumber,
      variant: value.card.variant,
      subject: value.card.subject,
      rarity: value.card.rarity,
      tier,
      tierKey: value.priceTierKey,
    };

    let succeeded = 0;
    let retryAfterMs: number | null = null;
    for (const provider of this.providers) {
      try {
        const sales = await provider.getRecentSales(target, since);
        await this.storeSales(provider.code, value.cardId, sales);
        succeeded++;
      } catch (error) {
        if (error instanceof ProviderRateLimitedError) retryAfterMs = error.retryAfterMs;
        this.logger.warn(`${provider.code} failed for ${value.cardId}/${value.priceTierKey}: ${String(error)}`);
      }
    }
    if (succeeded === 0) {
      await this.recordFailure(row.id, retryAfterMs);
      return;
    }

    await this.marketValue.recompute(value.cardId, value.priceTierKey, now);
    if (isFirstRefresh) await this.marketValue.backfillDaily(value.cardId, value.priceTierKey, HISTORY_DAYS, now);

    const priority = await this.priorityFor(value.cardId, value.priceTierKey);
    await this.prisma.cardMarketValue.update({
      where: { id: row.id },
      data: {
        consecutiveFailures: 0,
        refreshPriority: priority,
        lockedUntil: null,
        nextRefreshAt: new Date(now.getTime() + (REFRESH_INTERVAL_MS[priority] ?? 24 * HOUR_MS)),
      },
    });
  }

  private async claimDue(limit: number): Promise<ClaimedRow[]> {
    return this.prisma.$queryRaw<ClaimedRow[]>`
      UPDATE "CardMarketValue"
      SET "lockedUntil" = now() + make_interval(mins => ${LEASE_MINUTES}::int)
      WHERE id IN (
        SELECT id FROM "CardMarketValue"
        WHERE "nextRefreshAt" <= now()
          AND ("lockedUntil" IS NULL OR "lockedUntil" < now())
        ORDER BY "refreshPriority" DESC, "nextRefreshAt" ASC
        LIMIT ${limit}::int
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, "cardId", "priceTierKey"`;
  }

  private async storeSales(providerCode: string, cardId: string, sales: NormalizedSale[]): Promise<void> {
    const sourceId = this.sourceIds.get(providerCode);
    if (sourceId === undefined || sales.length === 0) return;
    const rows: Prisma.CardPriceHistoryCreateManyInput[] = sales.map((sale) => {
      const excluded = sale.matchConfidence < MIN_MATCH_CONFIDENCE;
      return {
        cardId,
        priceTierKey: tierKey(sale.tier),
        ...tierColumns(sale.tier),
        priceCents: sale.priceCents,
        currency: sale.currency,
        soldAt: sale.soldAt,
        sourceId,
        sourceReference: sale.sourceReference,
        listingTitle: sale.listingTitle,
        matchConfidence: new Prisma.Decimal(sale.matchConfidence.toFixed(2)),
        isExcluded: excluded,
        excludedReason: excluded ? 'LOW_MATCH_CONFIDENCE' : null,
      };
    });
    for (let i = 0; i < rows.length; i += 500) {
      await this.prisma.cardPriceHistory.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
    }
  }

  private async priorityFor(cardId: string, priceTierKey: string): Promise<number> {
    const inTrade = await this.prisma.tradeItem.count({
      where: { cardId, priceTierKey, trade: { status: { in: [...ACTIVE_TRADE_STATUSES] } } },
    });
    if (inTrade > 0) return REFRESH_PRIORITY.IN_TRADE;
    const collected = await this.prisma.collectionItem.count({ where: { cardId, priceTierKey } });
    return collected > 0 ? REFRESH_PRIORITY.COLLECTED : REFRESH_PRIORITY.IDLE;
  }

  private async recordFailure(id: string, retryAfterMs: number | null): Promise<void> {
    const row = await this.prisma.cardMarketValue.findUnique({ where: { id }, select: { consecutiveFailures: true } });
    const failures = (row?.consecutiveFailures ?? 0) + 1;
    const backoffMs = retryAfterMs ?? Math.min(2 ** failures * HOUR_MS, 24 * HOUR_MS);
    await this.prisma.cardMarketValue.updateMany({
      where: { id },
      data: { consecutiveFailures: failures, lockedUntil: null, nextRefreshAt: new Date(Date.now() + backoffMs) },
    });
  }
}

export function tierColumns(tier: PriceTier) {
  return tier.kind === 'GRADED'
    ? { condition: 'GRADED' as const, gradingCompany: tier.company, grade: new Prisma.Decimal(tier.grade) }
    : { condition: tier.condition, gradingCompany: null, grade: null };
}
