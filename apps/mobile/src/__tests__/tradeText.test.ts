import type { TradeParticipantResponse, TradeResponse } from '@card-trader/shared';
import { describeCash, describeDifference, sidesFor, statusHeadline } from '../features/trades/tradeText';

const participant = (role: 'INITIATOR' | 'COUNTERPARTY', name: string, total: number): TradeParticipantResponse => ({
  role,
  user: {
    publicId: `${name}-public-id`,
    username: name.toLowerCase(),
    displayName: name,
    avatarUrl: null,
    ratingAverage: null,
    completedTradeCount: 0,
    vendorName: null,
  },
  itemsTotalCents: total,
  hasAcceptedCurrentVersion: false,
  completionConfirmed: false,
  items: [],
});

function trade(overrides: Partial<TradeResponse> = {}): TradeResponse {
  return {
    id: 't1',
    status: 'DRAFT',
    version: 1,
    myRole: 'INITIATOR',
    initiator: participant('INITIATOR', 'Tom', 30000),
    counterparty: participant('COUNTERPARTY', 'Bob', 28000),
    calculation: {
      initiatorTotalCents: 30000,
      counterpartyTotalCents: 28000,
      differenceCents: 2000,
      suggestedCashPayer: 'COUNTERPARTY',
      suggestedCashCents: 2000,
      hasUnpricedItems: false,
    },
    cash: { payer: 'COUNTERPARTY', amountCents: 2000, isManual: false },
    finalValue: { initiatorGivesCents: 30000, counterpartyGivesCents: 30000 },
    allowedActions: ['EDIT', 'PROPOSE', 'CANCEL'],
    myReview: null,
    proposedByRole: null,
    proposalCount: 0,
    isCounterOffer: false,
    event: null,
    proposedAt: null,
    acceptedAt: null,
    completedAt: null,
    cancelledAt: null,
    declinedAt: null,
    createdAt: '2026-09-30T00:00:00Z',
    updatedAt: '2026-09-30T00:00:00Z',
    disclaimer: '',
    ...overrides,
  };
}

describe('trade text', () => {
  it('describes the spec example from the initiator side', () => {
    expect(describeDifference(trade())).toBe('$300 − $280 = $20');
    expect(describeCash(trade())).toBe('Bob adds $20');
  });

  it('flips perspective for the counterparty', () => {
    const t = trade({ myRole: 'COUNTERPARTY' });
    expect(sidesFor(t).mine.user.displayName).toBe('Bob');
    expect(describeCash(t)).toBe('You add $20');
    expect(describeDifference(t)).toBe('$280 − $300 = $20');
  });

  it('labels manual and balanced cash', () => {
    expect(describeCash(trade({ cash: { payer: 'COUNTERPARTY', amountCents: 1500, isManual: true } }))).toBe('Bob adds $15 (agreed)');
    expect(describeCash(trade({ cash: { payer: null, amountCents: 0, isManual: false } }))).toContain('balanced');
  });

  it('explains whose turn it is', () => {
    expect(statusHeadline(trade({ status: 'PROPOSED', proposedByRole: 'INITIATOR' }))).toBe('Waiting for Bob to respond');
    expect(statusHeadline(trade({ status: 'PROPOSED', proposedByRole: 'INITIATOR', myRole: 'COUNTERPARTY' }))).toBe('Tom sent you an offer');
  });

  it('calls out counteroffers and the confirm-received step', () => {
    const counter = trade({ status: 'PROPOSED', proposedByRole: 'COUNTERPARTY', proposalCount: 2, isCounterOffer: true });
    expect(statusHeadline(counter)).toBe('Bob sent you a counteroffer');
    expect(statusHeadline(trade({ status: 'PROPOSED', proposedByRole: 'COUNTERPARTY' }))).toBe('Bob sent you an offer');
    expect(statusHeadline(trade({ status: 'PROPOSED', proposedByRole: 'INITIATOR' }))).toBe('Waiting for Bob to respond');
    expect(statusHeadline(trade({ status: 'ACCEPTED' }))).toBe('Accepted — swap the cards, then tap Confirm received');
  });
});
