import { Injectable } from '@nestjs/common';
import type { Prisma, Review, TradeItem } from '@prisma/client';
import {
  MARKET_VALUE_DISCLAIMER,
  tierLabelFromKey,
  type CompSale,
  type ReviewResponse,
  type TradeItemResponse,
  type TradeListItem,
  type TradeParticipantResponse,
  type TradeResponse,
  type TradeRole,
} from '@card-trader/shared';
import { decimalToNumber } from '../../common/utils/decimal';
import { addDays, toIso } from '../../common/utils/dates';
import { publicUserSelect, UserMapper, type PublicUserSource } from '../users/user.mapper';
import { calculateTrade, effectiveCash, finalValue } from './trade-calculator';
import { allowedActions } from './trade-state-machine';

export const REVIEW_WINDOW_DAYS = 60;

export const tradeDetailInclude = {
  participants: {
    include: {
      user: { select: publicUserSelect },
      items: { orderBy: { createdAt: 'asc' } },
    },
  },
  reviews: { include: { reviewer: { select: publicUserSelect } } },
  event: { select: { id: true, title: true } },
} satisfies Prisma.TradeInclude;

export type TradeDetail = Prisma.TradeGetPayload<{ include: typeof tradeDetailInclude }>;
type ParticipantDetail = TradeDetail['participants'][number];

export const tradeListInclude = {
  participants: { include: { user: { select: publicUserSelect }, _count: { select: { items: true } } } },
} satisfies Prisma.TradeInclude;

export type TradeListRow = Prisma.TradeGetPayload<{ include: typeof tradeListInclude }>;

@Injectable()
export class TradeMapper {
  constructor(private readonly users: UserMapper) {}

  toItem(item: TradeItem): TradeItemResponse {
    return {
      id: item.id,
      collectionItemId: item.collectionItemId,
      cardId: item.cardId,
      quantity: item.quantity,
      cardName: item.cardName,
      setName: item.setName,
      cardNumber: item.cardNumber,
      variant: item.variant,
      category: item.category,
      condition: item.condition,
      gradingCompany: item.gradingCompany,
      grade: decimalToNumber(item.grade),
      certNumber: item.certNumber,
      tierLabel: tierLabelFromKey(item.priceTierKey),
      imageUrl: item.imageUrl,
      comps: readComps(item.comps),
      unitValueCents: item.unitValueCents,
      lineTotalCents: item.lineTotalCents,
      valueConfidence: item.valueConfidence,
      valuedAt: item.valuedAt.toISOString(),
    };
  }

  /** Every review belongs to a completed trade, so it is always a verified trade review. */
  toReview(review: Review & { reviewer: PublicUserSource }): ReviewResponse {
    return {
      id: review.id,
      tradeId: review.tradeId,
      rating: review.rating,
      comment: review.comment,
      reviewer: this.users.toLite(review.reviewer),
      verifiedTrade: true,
      createdAt: review.createdAt.toISOString(),
    };
  }

  toResponse(trade: TradeDetail, viewerId: string): TradeResponse {
    const initiator = this.requireRole(trade.participants, 'INITIATOR');
    const counterparty = this.requireRole(trade.participants, 'COUNTERPARTY');
    const me = trade.participants.find((p) => p.userId === viewerId);
    if (!me) throw new Error('Viewer is not a participant');

    const toLines = (p: ParticipantDetail) => p.items.map((i) => ({ unitValueCents: i.unitValueCents, quantity: i.quantity }));
    const calculation = calculateTrade(toLines(initiator), toLines(counterparty));
    const cash = effectiveCash(calculation, {
      isManual: trade.cashIsManual,
      payer: trade.agreedCashPayer,
      amountCents: trade.agreedCashCents,
    });
    const myReview = trade.reviews.find((r) => r.reviewerId === viewerId) ?? null;

    const toParticipant = (p: ParticipantDetail): TradeParticipantResponse => ({
      role: p.role,
      user: this.users.toLite(p.user),
      itemsTotalCents: p.role === 'INITIATOR' ? calculation.initiatorTotalCents : calculation.counterpartyTotalCents,
      hasAcceptedCurrentVersion: p.acceptedVersion === trade.version && ['PROPOSED', 'ACCEPTED', 'COMPLETED'].includes(trade.status),
      completionConfirmed: p.completionConfirmedAt !== null,
      items: p.items.map((i) => this.toItem(i)),
    });

    return {
      id: trade.id,
      status: trade.status,
      version: trade.version,
      myRole: me.role,
      initiator: toParticipant(initiator),
      counterparty: toParticipant(counterparty),
      calculation,
      cash,
      finalValue: finalValue(calculation, cash),
      allowedActions: allowedActions({
        status: trade.status,
        version: trade.version,
        myRole: me.role,
        proposedByRole: trade.proposedByRole,
        itemCount: initiator.items.length + counterparty.items.length,
        myCompletionConfirmed: me.completionConfirmedAt !== null,
        hasReviewed: myReview !== null,
        reviewWindowOpen: isReviewWindowOpen(trade.completedAt),
      }),
      myReview: myReview ? this.toReview(myReview) : null,
      proposedByRole: trade.proposedByRole,
      proposalCount: trade.proposalCount,
      isCounterOffer: isCounterOffer(trade),
      event: trade.event,
      proposedAt: toIso(trade.proposedAt),
      acceptedAt: toIso(trade.acceptedAt),
      completedAt: toIso(trade.completedAt),
      cancelledAt: toIso(trade.cancelledAt),
      declinedAt: toIso(trade.declinedAt),
      createdAt: trade.createdAt.toISOString(),
      updatedAt: trade.updatedAt.toISOString(),
      disclaimer: MARKET_VALUE_DISCLAIMER,
    };
  }

  toListItem(trade: TradeListRow, viewerId: string): TradeListItem {
    const me = trade.participants.find((p) => p.userId === viewerId);
    const other = trade.participants.find((p) => p.userId !== viewerId);
    if (!me || !other) throw new Error('Trade is missing a participant');
    const awaitingMe =
      (trade.status === 'PROPOSED' && trade.proposedByRole !== me.role) ||
      (trade.status === 'ACCEPTED' && me.completionConfirmedAt === null);
    return {
      id: trade.id,
      status: trade.status,
      myRole: me.role,
      otherUser: this.users.toLite(other.user),
      myItemsTotalCents: me.itemsTotalCents,
      theirItemsTotalCents: other.itemsTotalCents,
      itemCount: me._count.items + other._count.items,
      cash: { payer: trade.agreedCashPayer, amountCents: trade.agreedCashCents, isManual: trade.cashIsManual },
      awaitingMe,
      isCounterOffer: isCounterOffer(trade),
      updatedAt: trade.updatedAt.toISOString(),
      completedAt: toIso(trade.completedAt),
    };
  }

  private requireRole(participants: ParticipantDetail[], role: TradeRole): ParticipantDetail {
    const participant = participants.find((p) => p.role === role);
    if (!participant) throw new Error(`Trade is missing ${role}`);
    return participant;
  }
}

/** The offer on the table answers one from the other side. */
export function isCounterOffer(trade: { status: string; isCounterOffer: boolean }): boolean {
  return trade.status === 'PROPOSED' && trade.isCounterOffer;
}

/** Reads the comps snapshot defensively; it is written only by this service. */
export function readComps(json: Prisma.JsonValue): CompSale[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((entry) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const { priceCents, soldAt, source } = entry as Record<string, unknown>;
    if (typeof priceCents !== 'number' || typeof soldAt !== 'string' || typeof source !== 'string') return [];
    return [{ priceCents, soldAt, source }];
  });
}

export function isReviewWindowOpen(completedAt: Date | null, now: Date = new Date()): boolean {
  return completedAt !== null && now <= addDays(completedAt, REVIEW_WINDOW_DAYS);
}
