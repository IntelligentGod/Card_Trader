import { Injectable } from '@nestjs/common';
import type { TradeRole } from '@card-trader/shared';
import type { Tx } from '../../prisma/prisma.service';
import { calculateTrade, effectiveCash } from './trade-calculator';

/**
 * Keeps server-computed trade totals consistent. Every change of trade terms
 * goes through `recalculate`, which (optionally) resets acceptance by bumping
 * the version, so nobody can accept terms they have not seen.
 */
@Injectable()
export class TradeMaintenanceService {
  /** Row-level lock serializing all mutations of one trade. Call inside a transaction. */
  async lockTrade(tx: Tx, tradeId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Trade" WHERE id = ${tradeId}::uuid FOR UPDATE`;
    return rows.length === 1;
  }

  async recalculate(tx: Tx, tradeId: string, options: { resetToDraft: boolean }): Promise<void> {
    const trade = await tx.trade.findUniqueOrThrow({
      where: { id: tradeId },
      include: { participants: { include: { items: true } } },
    });
    const linesFor = (role: TradeRole) =>
      trade.participants
        .filter((p) => p.role === role)
        .flatMap((p) => p.items.map((i) => ({ unitValueCents: i.unitValueCents, quantity: i.quantity })));
    const calculation = calculateTrade(linesFor('INITIATOR'), linesFor('COUNTERPARTY'));
    const cash = effectiveCash(calculation, {
      isManual: trade.cashIsManual,
      payer: trade.agreedCashPayer,
      amountCents: trade.agreedCashCents,
    });

    for (const participant of trade.participants) {
      const total = participant.role === 'INITIATOR' ? calculation.initiatorTotalCents : calculation.counterpartyTotalCents;
      await tx.tradeParticipant.update({
        where: { id: participant.id },
        // A change of terms resets both acceptances and any "received" confirmation.
        data: {
          itemsTotalCents: total,
          ...(options.resetToDraft && { acceptedVersion: null, completionConfirmedAt: null }),
        },
      });
    }

    await tx.trade.update({
      where: { id: tradeId },
      data: {
        suggestedCashPayer: calculation.suggestedCashPayer,
        suggestedCashCents: calculation.suggestedCashCents,
        agreedCashPayer: cash.payer,
        agreedCashCents: cash.amountCents,
        ...(options.resetToDraft && {
          status: 'DRAFT',
          version: { increment: 1 },
          proposedByRole: null,
          proposedAt: null,
          acceptedAt: null,
        }),
      },
    });
  }

  /**
   * Called when a collection item is deleted or transferred: it is pulled from
   * every DRAFT/PROPOSED trade, and those trades return to DRAFT with new totals.
   * ACCEPTED trades are never touched here (callers block that case).
   */
  async removeCollectionItemFromOpenTrades(tx: Tx, collectionItemId: string, exceptTradeId?: string): Promise<string[]> {
    const items = await tx.tradeItem.findMany({
      where: {
        collectionItemId,
        trade: { status: { in: ['DRAFT', 'PROPOSED'] } },
        ...(exceptTradeId && { tradeId: { not: exceptTradeId } }),
      },
      select: { id: true, tradeId: true },
    });
    const tradeIds = [...new Set(items.map((i) => i.tradeId))];
    for (const tradeId of tradeIds) await this.lockTrade(tx, tradeId);
    if (items.length > 0) await tx.tradeItem.deleteMany({ where: { id: { in: items.map((i) => i.id) } } });
    for (const tradeId of tradeIds) await this.recalculate(tx, tradeId, { resetToDraft: true });
    return tradeIds;
  }
}
