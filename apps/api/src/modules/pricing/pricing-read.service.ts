import { Injectable } from '@nestjs/common';
import {
  MARKET_VALUE_DISCLAIMER,
  tierLabelFromKey,
  VALUE_RANGE_DAYS,
  type CardValueHistoryResponse,
  type MarketValueResponse,
  type SaleRecord,
  type ValueRange,
} from '@card-trader/shared';
import { addDays, startOfUtcDay, toDateString, toIso } from '../../common/utils/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { MarketValueService, type SaleWithSource } from './market-value/market-value.service';

export function toSaleRecord(sale: SaleWithSource): SaleRecord {
  return {
    id: sale.id,
    priceCents: sale.priceCents,
    soldAt: sale.soldAt.toISOString(),
    source: sale.source.name,
    tierKey: sale.priceTierKey,
    listingTitle: sale.listingTitle,
  };
}

/** Read-only pricing queries for the API. Only reads stored data — never calls providers. */
@Injectable()
export class PricingReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketValue: MarketValueService,
  ) {}

  async marketValueFor(cardId: string, tierKey: string, salesLimit = 3): Promise<MarketValueResponse> {
    const [row, recent] = await Promise.all([
      this.prisma.cardMarketValue.findUnique({ where: { cardId_priceTierKey: { cardId, priceTierKey: tierKey } } }),
      this.marketValue.recentComparableSales(cardId, tierKey, salesLimit),
    ]);
    return {
      cardId,
      tierKey,
      tierLabel: tierLabelFromKey(tierKey),
      valueCents: row?.valueCents ?? null,
      confidence: row?.confidence ?? 'NONE',
      sampleSize: row?.sampleSize ?? 0,
      lastSaleAt: toIso(row?.lastSaleAt),
      computedAt: toIso(row?.computedAt),
      algorithm: row?.algorithm ?? null,
      recentSales: recent.sales.map(toSaleRecord),
      disclaimer: MARKET_VALUE_DISCLAIMER,
    };
  }

  async recentSales(cardId: string, tierKey: string, limit: number): Promise<SaleRecord[]> {
    const { sales } = await this.marketValue.recentComparableSales(cardId, tierKey, limit);
    return sales.map(toSaleRecord);
  }

  async valueHistory(cardId: string, tierKey: string, range: ValueRange): Promise<CardValueHistoryResponse> {
    const from = addDays(startOfUtcDay(new Date()), -VALUE_RANGE_DAYS[range]);
    const [points, sales] = await Promise.all([
      this.prisma.cardMarketValueDaily.findMany({
        where: { cardId, priceTierKey: tierKey, date: { gte: from } },
        orderBy: { date: 'asc' },
      }),
      this.prisma.cardPriceHistory.findMany({
        where: { cardId, priceTierKey: tierKey, isExcluded: false, soldAt: { gte: from } },
        include: { source: true },
        orderBy: { soldAt: 'desc' },
        take: 200,
      }),
    ]);
    return {
      cardId,
      tierKey,
      tierLabel: tierLabelFromKey(tierKey),
      range,
      points: points.map((p) => ({ date: toDateString(p.date), valueCents: p.valueCents })),
      sales: sales.map(toSaleRecord),
    };
  }
}
