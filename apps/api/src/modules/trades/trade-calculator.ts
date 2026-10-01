import type { TradeCalculation, TradeCash, TradeRole } from '@card-trader/shared';

/**
 * Pure trade arithmetic. The server is the only place these numbers are
 * produced; the mobile client only displays them. All amounts are integer cents.
 */
export interface PricedLine {
  unitValueCents: number | null;
  quantity: number;
}

export function lineTotalCents(line: PricedLine): number {
  return (line.unitValueCents ?? 0) * line.quantity;
}

export function sumLines(lines: readonly PricedLine[]): number {
  return lines.reduce((total, line) => total + lineTotalCents(line), 0);
}

export function calculateTrade(
  initiatorLines: readonly PricedLine[],
  counterpartyLines: readonly PricedLine[],
): TradeCalculation {
  const initiatorTotalCents = sumLines(initiatorLines);
  const counterpartyTotalCents = sumLines(counterpartyLines);
  const differenceCents = initiatorTotalCents - counterpartyTotalCents;

  // difference > 0: initiator gives more value → counterparty may add cash (and vice versa).
  const suggestedCashPayer: TradeRole | null =
    differenceCents > 0 ? 'COUNTERPARTY' : differenceCents < 0 ? 'INITIATOR' : null;

  return {
    initiatorTotalCents,
    counterpartyTotalCents,
    differenceCents,
    suggestedCashPayer,
    suggestedCashCents: Math.abs(differenceCents),
    hasUnpricedItems: [...initiatorLines, ...counterpartyLines].some((line) => line.unitValueCents === null),
  };
}

/** The cash actually agreed: the suggestion, unless the users set a manual amount. */
export function effectiveCash(
  calculation: TradeCalculation,
  manual: { isManual: boolean; payer: TradeRole | null; amountCents: number },
): TradeCash {
  if (manual.isManual) {
    return { payer: manual.amountCents > 0 ? manual.payer : null, amountCents: manual.amountCents, isManual: true };
  }
  return { payer: calculation.suggestedCashPayer, amountCents: calculation.suggestedCashCents, isManual: false };
}

/** Total value each side hands over, cards plus any cash they pay. */
export function finalValue(
  calculation: TradeCalculation,
  cash: TradeCash,
): { initiatorGivesCents: number; counterpartyGivesCents: number } {
  return {
    initiatorGivesCents: calculation.initiatorTotalCents + (cash.payer === 'INITIATOR' ? cash.amountCents : 0),
    counterpartyGivesCents: calculation.counterpartyTotalCents + (cash.payer === 'COUNTERPARTY' ? cash.amountCents : 0),
  };
}
