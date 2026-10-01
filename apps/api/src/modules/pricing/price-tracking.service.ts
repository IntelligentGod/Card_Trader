import { Injectable } from '@nestjs/common';
import { PrismaService, type Tx } from '../../prisma/prisma.service';

export const REFRESH_PRIORITY = { IDLE: 0, COLLECTED: 2, IN_TRADE: 3, NEW: 5 } as const;

/**
 * API-side hook into the background pricing system. Requests never call
 * providers; they only mark a card+tier as needing a refresh, which the worker
 * picks up on its next run.
 */
@Injectable()
export class PriceTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureTracked(cardId: string, tierKey: string, tx: Tx = this.prisma): Promise<void> {
    const existing = await tx.cardMarketValue.findUnique({
      where: { cardId_priceTierKey: { cardId, priceTierKey: tierKey } },
      select: { id: true, computedAt: true, refreshPriority: true },
    });
    if (!existing) {
      await tx.cardMarketValue.upsert({
        where: { cardId_priceTierKey: { cardId, priceTierKey: tierKey } },
        create: { cardId, priceTierKey: tierKey, nextRefreshAt: new Date(), refreshPriority: REFRESH_PRIORITY.NEW },
        update: {},
      });
      return;
    }
    if (!existing.computedAt) {
      await tx.cardMarketValue.update({
        where: { id: existing.id },
        data: { nextRefreshAt: new Date(), refreshPriority: Math.max(existing.refreshPriority, REFRESH_PRIORITY.NEW) },
      });
    }
  }

  /** Current estimate for a card+tier, used when snapshotting trade items. */
  async currentValue(cardId: string, tierKey: string, tx: Tx = this.prisma) {
    return tx.cardMarketValue.findUnique({
      where: { cardId_priceTierKey: { cardId, priceTierKey: tierKey } },
      select: { valueCents: true, confidence: true, computedAt: true },
    });
  }
}
