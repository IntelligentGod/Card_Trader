import { AppException } from '../../common/errors/app.exception';
import { allowedActions, assertAllowed, assertVersion, type TradeStateView } from './trade-state-machine';

const base: TradeStateView = {
  status: 'DRAFT',
  version: 3,
  myRole: 'INITIATOR',
  proposedByRole: null,
  itemCount: 2,
  myCompletionConfirmed: false,
  hasReviewed: false,
  reviewWindowOpen: false,
};

describe('trade state machine', () => {
  it('draft: edit, propose (only with items), cancel', () => {
    expect(allowedActions(base)).toEqual(['EDIT', 'PROPOSE', 'CANCEL']);
    expect(allowedActions({ ...base, itemCount: 0 })).toEqual(['EDIT', 'CANCEL']);
  });

  it('proposed: only the other side can accept, decline or counter', () => {
    const proposed = { ...base, status: 'PROPOSED' as const, proposedByRole: 'INITIATOR' as const };
    expect(allowedActions(proposed)).toEqual(['EDIT', 'CANCEL']);
    expect(allowedActions({ ...proposed, myRole: 'COUNTERPARTY' })).toEqual([
      'EDIT',
      'ACCEPT',
      'DECLINE',
      'COUNTER',
      'CANCEL',
    ]);
  });

  it('accepted: each side confirms received once; terms stay editable (edits reset acceptance)', () => {
    const accepted = { ...base, status: 'ACCEPTED' as const };
    expect(allowedActions(accepted)).toEqual(['EDIT', 'COMPLETE', 'CANCEL']);
    expect(allowedActions({ ...accepted, myCompletionConfirmed: true })).toEqual(['EDIT', 'CANCEL']);
  });

  it('completed: review once, only inside the window', () => {
    const completed = { ...base, status: 'COMPLETED' as const, reviewWindowOpen: true };
    expect(allowedActions(completed)).toEqual(['REVIEW']);
    expect(allowedActions({ ...completed, hasReviewed: true })).toEqual([]);
    expect(allowedActions({ ...completed, reviewWindowOpen: false })).toEqual([]);
  });

  it('closed trades allow nothing else', () => {
    expect(allowedActions({ ...base, status: 'CANCELLED' })).toEqual([]);
    expect(allowedActions({ ...base, status: 'DECLINED' })).toEqual([]);
  });

  it('assertAllowed throws a 409 with a stable code', () => {
    expect.assertions(3);
    try {
      assertAllowed('ACCEPT', base);
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(409);
      expect((error as AppException).code).toBe('TRADE_ACTION_NOT_ALLOWED');
    }
  });

  it('assertVersion rejects stale terms', () => {
    expect(() => assertVersion(base, 3)).not.toThrow();
    expect(() => assertVersion(base, 2)).toThrow(AppException);
  });
});
