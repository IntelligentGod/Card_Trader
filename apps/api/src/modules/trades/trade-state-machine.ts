import type { TradeAction, TradeRole, TradeStatus } from '@card-trader/shared';
import { Errors } from '../../common/errors/app.exception';

/**
 * Trade lifecycle:
 *
 *   DRAFT ──send(v)──▶ PROPOSED ──accept(v, other side)──▶ ACCEPTED ──both confirm received──▶ COMPLETED
 *     ▲                  │  └──decline (other side)──▶ DECLINED
 *     └──any edit (v+1)──┴──────────── any edit (v+1) ─────┘
 *   DRAFT | PROPOSED | ACCEPTED ──cancel──▶ CANCELLED
 *
 * Sending counts as the sender accepting that version. A counteroffer is the
 * receiver editing the offer and sending it back. Any change — including after
 * acceptance — returns the trade to DRAFT with a new version, which resets both
 * acceptances and any "received" confirmations.
 */
export interface TradeStateView {
  status: TradeStatus;
  version: number;
  myRole: TradeRole;
  proposedByRole: TradeRole | null;
  itemCount: number;
  myCompletionConfirmed: boolean;
  hasReviewed: boolean;
  /** Reviews are accepted for a limited time after completion. */
  reviewWindowOpen: boolean;
}

export const EDITABLE_STATUSES: readonly TradeStatus[] = ['DRAFT', 'PROPOSED', 'ACCEPTED'];

export function allowedActions(view: TradeStateView): TradeAction[] {
  const actions: TradeAction[] = [];
  const isResponder = view.status === 'PROPOSED' && view.proposedByRole !== null && view.proposedByRole !== view.myRole;

  if (EDITABLE_STATUSES.includes(view.status)) actions.push('EDIT');
  if (view.status === 'DRAFT' && view.itemCount > 0) actions.push('PROPOSE');
  if (isResponder) actions.push('ACCEPT', 'DECLINE', 'COUNTER');
  if (view.status === 'ACCEPTED' && !view.myCompletionConfirmed) actions.push('COMPLETE');
  if (view.status === 'DRAFT' || view.status === 'PROPOSED' || view.status === 'ACCEPTED') actions.push('CANCEL');
  if (view.status === 'COMPLETED' && !view.hasReviewed && view.reviewWindowOpen) actions.push('REVIEW');
  return actions;
}

const DENIAL_MESSAGES: Record<TradeAction, string> = {
  EDIT: 'This trade can no longer be edited',
  PROPOSE: 'Only a draft trade with at least one card can be sent',
  COUNTER: 'Only the receiver of an offer can counter it',
  ACCEPT: 'Only the other trader can accept a proposed trade',
  DECLINE: 'Only the other trader can decline a proposed trade',
  COMPLETE: 'Only an accepted trade can be confirmed as received, once per trader',
  CANCEL: 'This trade is already closed',
  REVIEW: 'This trade cannot be reviewed',
};

export function assertAllowed(action: TradeAction, view: TradeStateView): void {
  if (!allowedActions(view).includes(action)) {
    throw Errors.conflict('TRADE_ACTION_NOT_ALLOWED', DENIAL_MESSAGES[action], { action, status: view.status });
  }
}

export function assertVersion(view: TradeStateView, expectedVersion: number): void {
  if (view.version !== expectedVersion) {
    throw Errors.conflict('TRADE_VERSION_MISMATCH', 'The trade changed since you last viewed it. Review the latest terms.', {
      currentVersion: view.version,
    });
  }
}
