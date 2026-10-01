import { Injectable, Logger } from '@nestjs/common';
import { startOfUtcDay, toDateString } from '../../../common/utils/dates';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Nightly job:
 *  1. Carries each current estimate into today's CardMarketValueDaily row, so
 *     cards without new sales still have a continuous chart.
 *  2. Writes one PortfolioSnapshot row per user per category.
 * Both statements are idempotent and safe to re-run.
 */
@Injectable()
export class DailySnapshotService {
  private readonly logger = new Logger(DailySnapshotService.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(date: Date = startOfUtcDay(new Date())): Promise<void> {
    const day = toDateString(date);
    const carried = await this.prisma.$executeRaw`
      INSERT INTO "CardMarketValueDaily" ("cardId", "priceTierKey", "date", "valueCents")
      SELECT "cardId", "priceTierKey", ${day}::date, "valueCents"
      FROM "CardMarketValue"
      WHERE "valueCents" IS NOT NULL
      ON CONFLICT ("cardId", "priceTierKey", "date") DO NOTHING`;

    const snapshots = await this.prisma.$executeRaw`
      INSERT INTO "PortfolioSnapshot" ("userId", "date", "category", "valueCents", "cardCount")
      SELECT ci."userId", ${day}::date, c."category",
             COALESCE(SUM(ci."quantity"::bigint * ci."estimatedValueCents"), 0),
             SUM(ci."quantity")::int
      FROM "CollectionItem" ci
      JOIN "Card" c ON c.id = ci."cardId"
      GROUP BY ci."userId", c."category"
      ON CONFLICT ("userId", "date", "category")
      DO UPDATE SET "valueCents" = EXCLUDED."valueCents", "cardCount" = EXCLUDED."cardCount"`;

    this.logger.log(`Daily snapshot ${day}: ${carried} card values carried, ${snapshots} portfolio rows`);
  }
}
