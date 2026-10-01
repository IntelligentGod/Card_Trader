import { formatCents, type TradeResponse, type TradeRole } from '@card-trader/shared';

export interface TradeSides {
  mine: TradeResponse['initiator'];
  theirs: TradeResponse['initiator'];
}

export function sidesFor(trade: TradeResponse): TradeSides {
  return trade.myRole === 'INITIATOR'
    ? { mine: trade.initiator, theirs: trade.counterparty }
    : { mine: trade.counterparty, theirs: trade.initiator };
}

function nameFor(trade: TradeResponse, role: TradeRole): string {
  if (role === trade.myRole) return 'You';
  return (role === 'INITIATOR' ? trade.initiator : trade.counterparty).user.displayName;
}

/** "Bob adds $20" / "You add $15 (agreed)" / "Values are balanced". */
export function describeCash(trade: TradeResponse): string {
  const { payer, amountCents, isManual } = trade.cash;
  if (!payer || amountCents === 0) return isManual ? 'No cash (agreed)' : 'Values are balanced — no cash needed';
  const who = nameFor(trade, payer);
  const verb = who === 'You' ? 'add' : 'adds';
  return `${who} ${verb} ${formatCents(amountCents)}${isManual ? ' (agreed)' : ''}`;
}

/** "$300 − $280 = $20" from the viewer's perspective. */
export function describeDifference(trade: TradeResponse): string {
  const { mine, theirs } = sidesFor(trade);
  const diff = mine.itemsTotalCents - theirs.itemsTotalCents;
  return `${formatCents(mine.itemsTotalCents)} − ${formatCents(theirs.itemsTotalCents)} = ${formatCents(Math.abs(diff))}`;
}

export function statusHeadline(trade: TradeResponse): string {
  const { theirs } = sidesFor(trade);
  const other = theirs.user.displayName;
  switch (trade.status) {
    case 'DRAFT':
      return 'Building the trade';
    case 'PROPOSED':
      if (trade.proposedByRole === trade.myRole) return `Waiting for ${other} to respond`;
      return trade.isCounterOffer ? `${other} sent you a counteroffer` : `${other} sent you an offer`;
    case 'ACCEPTED':
      return sidesFor(trade).mine.completionConfirmed
        ? `Waiting for ${other} to confirm they received the cards`
        : 'Accepted — swap the cards, then tap Confirm received';
    case 'COMPLETED':
      return 'Trade completed';
    case 'CANCELLED':
      return 'Trade cancelled';
    case 'DECLINED':
      return 'Trade declined';
  }
}
