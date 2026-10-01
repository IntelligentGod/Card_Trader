import { Injectable } from '@nestjs/common';
import type { NotificationType, Prisma } from '@prisma/client';
import {
  ACTIVE_TRADE_STATUSES,
  CLOSED_TRADE_STATUSES,
  type CompSale,
  type Paginated,
  type TradeListItem,
  type TradeResponse,
} from '@card-trader/shared';
import { Errors } from '../../common/errors/app.exception';
import { pageArgs, toPage } from '../../common/pagination/pagination';
import { startOfUtcDay } from '../../common/utils/dates';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MarketValueService } from '../pricing/market-value/market-value.service';
import { PriceTrackingService } from '../pricing/price-tracking.service';
import { StorageService } from '../uploads/storage.service';
import { UsersService } from '../users/users.service';
import type { AddTradeItemDto, CreateTradeDto, SetTradeCashDto, TradeListQueryDto } from './dto/trades.dto';
import { TradeMaintenanceService } from './trade-maintenance.service';
import { isReviewWindowOpen, TradeMapper, tradeDetailInclude, tradeListInclude, type TradeDetail } from './trade.mapper';
import { assertAllowed, assertVersion, type TradeStateView } from './trade-state-machine';

export const MAX_OPEN_TRADES_PER_USER = 25;
export const MAX_ITEMS_PER_TRADE = 50;
/** Comparable sales snapshotted with each trade line (the "3 most recent"). */
export const TRADE_COMPS_COUNT = 3;

type Participant = TradeDetail['participants'][number];
type Mutation = (tx: Tx, trade: TradeDetail, me: Participant, other: Participant) => Promise<void>;

/**
 * Trade use cases. Every mutation:
 *   1. verifies the caller participates (404 otherwise — no existence leak),
 *   2. locks the trade row (serializes concurrent edits/accepts),
 *   3. checks the state machine and, where terms are agreed, the version,
 *   4. recomputes totals server-side.
 */
@Injectable()
export class TradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly mapper: TradeMapper,
    private readonly maintenance: TradeMaintenanceService,
    private readonly tracking: PriceTrackingService,
    private readonly storage: StorageService,
    private readonly marketValue: MarketValueService,
    private readonly notifications: NotificationsService,
  ) {}

  // ───────────── Queries ─────────────

  async list(userId: string, query: TradeListQueryDto): Promise<Paginated<TradeListItem>> {
    const statuses = query.scope === 'history' ? CLOSED_TRADE_STATUSES : ACTIVE_TRADE_STATUSES;
    const rows = await this.prisma.trade.findMany({
      where: { status: { in: [...statuses] }, participants: { some: { userId } } },
      include: tradeListInclude,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      ...pageArgs(query),
    });
    return toPage(rows, query, (row) => this.mapper.toListItem(row, userId));
  }

  async get(userId: string, tradeId: string): Promise<TradeResponse> {
    return this.mapper.toResponse(await this.loadForViewer(this.prisma, userId, tradeId), userId);
  }

  // ───────────── Creation & editing ─────────────

  async create(userId: string, dto: CreateTradeDto): Promise<TradeResponse> {
    const counterparty = await this.users.findActiveByPublicId(dto.counterpartyPublicId);
    if (counterparty.id === userId) throw Errors.badRequest('CANNOT_TRADE_WITH_SELF', 'You cannot trade with yourself');
    const eventId = dto.eventId ? await this.requirePublishedEvent(dto.eventId) : null;

    // Scanning the same person twice at a show should reopen the same draft.
    const existing = await this.prisma.trade.findFirst({
      where: {
        status: 'DRAFT',
        createdById: userId,
        participants: { some: { userId: counterparty.id, role: 'COUNTERPARTY' } },
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, eventId: true },
    });
    if (existing) {
      if (eventId && existing.eventId !== eventId) {
        await this.prisma.trade.update({ where: { id: existing.id }, data: { eventId } });
      }
      return this.get(userId, existing.id);
    }

    const open = await this.prisma.tradeParticipant.count({
      where: { userId, trade: { status: { in: [...ACTIVE_TRADE_STATUSES] } } },
    });
    if (open >= MAX_OPEN_TRADES_PER_USER) {
      throw Errors.conflict('TOO_MANY_OPEN_TRADES', 'Finish or cancel some open trades first');
    }

    const trade = await this.prisma.trade.create({
      data: {
        createdById: userId,
        eventId,
        participants: {
          create: [
            { userId, role: 'INITIATOR' },
            { userId: counterparty.id, role: 'COUNTERPARTY' },
          ],
        },
      },
      select: { id: true },
    });
    return this.get(userId, trade.id);
  }

  addItem(userId: string, tradeId: string, dto: AddTradeItemDto): Promise<TradeResponse> {
    return this.mutate(userId, tradeId, async (tx, trade, me, other) => {
      assertAllowed('EDIT', this.view(trade, userId));

      const item = await tx.collectionItem.findUnique({
        where: { id: dto.collectionItemId },
        include: { card: { include: { set: true } } },
      });
      const owner = item ? trade.participants.find((p) => p.userId === item.userId) : undefined;
      // Other users' personal-collection cards are indistinguishable from non-existent ones.
      // Cards listed for trade and/or sale can be added (a sale is a trade with cash).
      if (!item || !owner || (owner.userId !== userId && item.listingStatus === 'PERSONAL')) {
        throw Errors.notFound('COLLECTION_ITEM_NOT_FOUND', 'Card not found');
      }
      const quantity = dto.quantity ?? 1;
      if (quantity > item.quantity) {
        throw Errors.badRequest('QUANTITY_EXCEEDS_OWNED', `Only ${item.quantity} ${item.quantity === 1 ? 'copy' : 'copies'} available`);
      }
      const allItems = trade.participants.flatMap((p) => p.items);
      if (allItems.some((i) => i.collectionItemId === item.id)) {
        throw Errors.conflict('ITEM_ALREADY_IN_TRADE', 'This card is already in the trade');
      }
      if (allItems.length >= MAX_ITEMS_PER_TRADE) {
        throw Errors.conflict('TOO_MANY_ITEMS', `A trade can include at most ${MAX_ITEMS_PER_TRADE} cards`);
      }
      const lockedElsewhere = await tx.tradeItem.count({
        where: { collectionItemId: item.id, tradeId: { not: trade.id }, trade: { status: 'ACCEPTED' } },
      });
      if (lockedElsewhere > 0) throw Errors.conflict('ITEM_LOCKED_IN_TRADE', 'This card is committed to another accepted trade');

      const value = await this.tracking.currentValue(item.cardId, item.priceTierKey, tx);
      const unitValueCents = value?.valueCents ?? null;
      const comps = await this.compsFor(item.cardId, item.priceTierKey);
      await tx.tradeItem.create({
        data: {
          tradeId: trade.id,
          participantId: owner.id,
          collectionItemId: item.id,
          cardId: item.cardId,
          quantity,
          cardName: item.card.name,
          setName: item.card.set.name,
          cardNumber: item.card.cardNumber,
          variant: item.card.variant,
          category: item.card.category,
          condition: item.condition,
          gradingCompany: item.gradingCompany,
          grade: item.grade,
          certNumber: item.certNumber,
          priceTierKey: item.priceTierKey,
          imageUrl: this.storage.urlFor(item.customImageKey) ?? item.card.imageUrl,
          comps: toJsonComps(comps),
          unitValueCents,
          valueConfidence: value?.confidence ?? 'NONE',
          valuedAt: new Date(),
          lineTotalCents: (unitValueCents ?? 0) * quantity,
        },
      });
      await this.maintenance.recalculate(tx, trade.id, { resetToDraft: true });
      await this.notifyTermsChanged(tx, trade, me, other);
    });
  }

  removeItem(userId: string, tradeId: string, tradeItemId: string): Promise<TradeResponse> {
    return this.mutate(userId, tradeId, async (tx, trade, me, other) => {
      assertAllowed('EDIT', this.view(trade, userId));
      const exists = trade.participants.some((p) => p.items.some((i) => i.id === tradeItemId));
      if (!exists) throw Errors.notFound('TRADE_ITEM_NOT_FOUND', 'Card is not part of this trade');
      await tx.tradeItem.delete({ where: { id: tradeItemId } });
      await this.maintenance.recalculate(tx, trade.id, { resetToDraft: true });
      await this.notifyTermsChanged(tx, trade, me, other);
    });
  }

  /** Users may agree on a cash amount different from the suggestion. */
  setCash(userId: string, tradeId: string, dto: SetTradeCashDto): Promise<TradeResponse> {
    return this.mutate(userId, tradeId, async (tx, trade, me, other) => {
      assertAllowed('EDIT', this.view(trade, userId));
      if (dto.useSuggested) {
        await tx.trade.update({ where: { id: trade.id }, data: { cashIsManual: false } });
      } else {
        if (dto.amountCents > 0 && dto.payer === null) {
          throw Errors.badRequest('CASH_PAYER_REQUIRED', 'Choose who pays the cash amount');
        }
        await tx.trade.update({
          where: { id: trade.id },
          data: {
            cashIsManual: true,
            agreedCashCents: dto.amountCents,
            agreedCashPayer: dto.amountCents > 0 ? dto.payer : null,
          },
        });
      }
      await this.maintenance.recalculate(tx, trade.id, { resetToDraft: true });
      await this.notifyTermsChanged(tx, trade, me, other);
    });
  }

  /** Re-snapshots every card at its current estimate. Only changes terms if a value moved. */
  refreshValues(userId: string, tradeId: string): Promise<TradeResponse> {
    return this.mutate(userId, tradeId, async (tx, trade, me, other) => {
      assertAllowed('EDIT', this.view(trade, userId));
      let changed = false;
      for (const item of trade.participants.flatMap((p) => p.items)) {
        const value = await this.tracking.currentValue(item.cardId, item.priceTierKey, tx);
        const unitValueCents = value?.valueCents ?? null;
        if (unitValueCents !== item.unitValueCents) changed = true;
        const comps = await this.compsFor(item.cardId, item.priceTierKey);
        await tx.tradeItem.update({
          where: { id: item.id },
          data: {
            unitValueCents,
            comps: toJsonComps(comps),
            valueConfidence: value?.confidence ?? 'NONE',
            valuedAt: new Date(),
            lineTotalCents: (unitValueCents ?? 0) * item.quantity,
          },
        });
      }
      await this.maintenance.recalculate(tx, trade.id, { resetToDraft: changed });
      if (changed) await this.notifyTermsChanged(tx, trade, me, other);
    });
  }

  // ───────────── Lifecycle ─────────────

  propose(userId: string, tradeId: string, expectedVersion: number): Promise<TradeResponse> {
    return this.mutate(userId, tradeId, async (tx, trade, me, other) => {
      const view = this.view(trade, userId);
      assertAllowed('PROPOSE', view);
      assertVersion(view, expectedVersion);
      await this.assertItemsAvailable(tx, trade);

      await tx.tradeParticipant.update({ where: { id: me.id }, data: { acceptedVersion: trade.version } });
      await tx.tradeParticipant.update({ where: { id: other.id }, data: { acceptedVersion: null } });
      // Re-sending your own edited offer is not a counteroffer; answering the other side's is.
      const isCounter = trade.lastProposedByRole !== null && trade.lastProposedByRole !== me.role;
      await tx.trade.update({
        where: { id: trade.id },
        data: {
          status: 'PROPOSED',
          proposedByRole: me.role,
          lastProposedByRole: me.role,
          isCounterOffer: isCounter,
          proposedAt: new Date(),
          proposalCount: { increment: 1 },
        },
      });
      await this.notifyOther(tx, trade, me, other, isCounter ? 'TRADE_COUNTER' : 'TRADE_OFFER', (name) =>
        isCounter
          ? { title: 'Counteroffer received', body: `${name} sent you a counteroffer. Review the new terms.` }
          : { title: 'New trade offer', body: `${name} sent you a trade offer.` },
      );
    });
  }

  accept(userId: string, tradeId: string, expectedVersion: number): Promise<TradeResponse> {
    return this.mutate(userId, tradeId, async (tx, trade, me, other) => {
      const view = this.view(trade, userId);
      assertAllowed('ACCEPT', view);
      assertVersion(view, expectedVersion);
      await this.assertItemsAvailable(tx, trade);

      await tx.tradeParticipant.update({ where: { id: me.id }, data: { acceptedVersion: trade.version } });
      // The TradeItem snapshots stay frozen unless someone changes the terms,
      // which returns the trade to DRAFT and resets both acceptances.
      await tx.trade.update({ where: { id: trade.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
      await this.notifyOther(tx, trade, me, other, 'TRADE_ACCEPTED', (name) => ({
        title: 'Trade accepted',
        body: `${name} accepted your offer. Swap the cards, then tap Confirm received.`,
      }));
    });
  }

  decline(userId: string, tradeId: string): Promise<TradeResponse> {
    return this.mutate(userId, tradeId, async (tx, trade, me, other) => {
      assertAllowed('DECLINE', this.view(trade, userId));
      await tx.trade.update({ where: { id: trade.id }, data: { status: 'DECLINED', declinedAt: new Date() } });
      await this.notifyOther(tx, trade, me, other, 'TRADE_DECLINED', (name) => ({
        title: 'Offer declined',
        body: `${name} declined your trade offer.`,
      }));
    });
  }

  cancel(userId: string, tradeId: string): Promise<TradeResponse> {
    return this.mutate(userId, tradeId, async (tx, trade, me, other) => {
      assertAllowed('CANCEL', this.view(trade, userId));
      await tx.trade.update({
        where: { id: trade.id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledByRole: me.role },
      });
      // A draft nobody has seen yet is cancelled silently.
      if (trade.status !== 'DRAFT' || trade.proposalCount > 0) {
        await this.notifyOther(tx, trade, me, other, 'TRADE_CANCELLED', (name) => ({
          title: 'Trade cancelled',
          body: `${name} cancelled your trade.`,
        }));
      }
    });
  }

  /** Each trader confirms they received the cards; the second confirmation completes the trade. */
  complete(userId: string, tradeId: string): Promise<TradeResponse> {
    return this.mutate(userId, tradeId, async (tx, trade, me, other) => {
      assertAllowed('COMPLETE', this.view(trade, userId));
      const now = new Date();
      await tx.tradeParticipant.update({ where: { id: me.id }, data: { completionConfirmedAt: now } });
      if (!other.completionConfirmedAt) return;

      await this.transferCards(tx, trade);
      await tx.trade.update({ where: { id: trade.id }, data: { status: 'COMPLETED', completedAt: now } });
      await tx.profile.updateMany({
        where: { userId: { in: [me.userId, other.userId] } },
        data: { completedTradeCount: { increment: 1 } },
      });
      await this.notifications.notify(
        tx,
        [me, other].map((p) => ({
          userId: p.userId,
          type: 'TRADE_COMPLETED' as const,
          title: 'Trade completed',
          body: 'Both sides confirmed. Your inventory is updated — leave a review for your trade partner.',
          data: { tradeId: trade.id },
        })),
      );
    });
  }

  // ───────────── Internals ─────────────

  /** The last comparable sales behind the current estimate, frozen with the trade line. */
  private async compsFor(cardId: string, tierKey: string): Promise<CompSale[]> {
    const { sales } = await this.marketValue.recentComparableSales(cardId, tierKey, TRADE_COMPS_COUNT);
    return sales.map((sale) => ({ priceCents: sale.priceCents, soldAt: sale.soldAt.toISOString(), source: sale.source.name }));
  }

  private async requirePublishedEvent(eventId: string): Promise<string> {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, status: 'PUBLISHED' }, select: { id: true } });
    if (!event) throw Errors.notFound('EVENT_NOT_FOUND', 'Event not found');
    return event.id;
  }

  private async notifyOther(
    tx: Tx,
    trade: TradeDetail,
    me: Participant,
    other: Participant,
    type: NotificationType,
    text: (myName: string) => { title: string; body: string },
  ): Promise<void> {
    const myName = me.user.profile?.displayName ?? 'Your trade partner';
    await this.notifications.notify(tx, { userId: other.userId, type, ...text(myName), data: { tradeId: trade.id } });
  }

  /** An edit resets an offer or an acceptance; the other trader must know. */
  private async notifyTermsChanged(tx: Tx, trade: TradeDetail, me: Participant, other: Participant): Promise<void> {
    if (trade.status !== 'ACCEPTED' && trade.status !== 'PROPOSED') return;
    await this.notifyOther(tx, trade, me, other, 'TRADE_TERMS_CHANGED', (name) => ({
      title: 'Trade terms changed',
      body:
        trade.status === 'ACCEPTED'
          ? `${name} changed your accepted trade. Both acceptances were reset — review the new terms.`
          : `${name} is changing the offer. You will be notified when it is sent again.`,
    }));
  }

  private async mutate(userId: string, tradeId: string, mutation: Mutation): Promise<TradeResponse> {
    await this.prisma.$transaction(
      async (tx) => {
        const membership = await tx.tradeParticipant.findUnique({ where: { tradeId_userId: { tradeId, userId } } });
        if (!membership) throw Errors.notFound('TRADE_NOT_FOUND', 'Trade not found');
        await this.maintenance.lockTrade(tx, tradeId);
        const trade = await this.loadForViewer(tx, userId, tradeId);
        const me = trade.participants.find((p) => p.userId === userId);
        const other = trade.participants.find((p) => p.userId !== userId);
        if (!me || !other) throw new Error('Trade is missing a participant');
        await mutation(tx, trade, me, other);
      },
      { timeout: 20_000 },
    );
    return this.get(userId, tradeId);
  }

  private async loadForViewer(tx: Tx, userId: string, tradeId: string): Promise<TradeDetail> {
    const trade = await tx.trade.findFirst({
      where: { id: tradeId, participants: { some: { userId } } },
      include: tradeDetailInclude,
    });
    if (!trade) throw Errors.notFound('TRADE_NOT_FOUND', 'Trade not found');
    return trade;
  }

  private view(trade: TradeDetail, userId: string): TradeStateView {
    const me = trade.participants.find((p) => p.userId === userId);
    if (!me) throw Errors.notFound('TRADE_NOT_FOUND', 'Trade not found');
    return {
      status: trade.status,
      version: trade.version,
      myRole: me.role,
      proposedByRole: trade.proposedByRole,
      itemCount: trade.participants.reduce((n, p) => n + p.items.length, 0),
      myCompletionConfirmed: me.completionConfirmedAt !== null,
      hasReviewed: trade.reviews.some((r) => r.reviewerId === userId),
      reviewWindowOpen: isReviewWindowOpen(trade.completedAt),
    };
  }

  /** Locks the source collection rows and verifies every card is still owned and uncommitted. */
  private async assertItemsAvailable(tx: Tx, trade: TradeDetail): Promise<void> {
    const lines = trade.participants.flatMap((p) => p.items.map((item) => ({ item, ownerId: p.userId })));
    const missing = lines.find((l) => l.item.collectionItemId === null);
    if (missing) {
      throw Errors.conflict('TRADE_ITEMS_UNAVAILABLE', `${missing.item.cardName} is no longer available`);
    }
    const ids = lines.map((l) => l.item.collectionItemId as string);
    if (ids.length === 0) return;

    await tx.$queryRaw`SELECT id FROM "CollectionItem" WHERE id = ANY(${ids}::uuid[]) FOR UPDATE`;
    const rows = await tx.collectionItem.findMany({ where: { id: { in: ids } } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const { item, ownerId } of lines) {
      const row = byId.get(item.collectionItemId as string);
      if (!row || row.userId !== ownerId || row.quantity < item.quantity || row.priceTierKey !== item.priceTierKey) {
        throw Errors.conflict('TRADE_ITEMS_UNAVAILABLE', `${item.cardName} is no longer available as offered`);
      }
    }
    const lockedElsewhere = await tx.tradeItem.findFirst({
      where: { collectionItemId: { in: ids }, tradeId: { not: trade.id }, trade: { status: 'ACCEPTED' } },
      select: { cardName: true },
    });
    if (lockedElsewhere) {
      throw Errors.conflict('ITEM_LOCKED_IN_TRADE', `${lockedElsewhere.cardName} is committed to another accepted trade`);
    }
  }

  /**
   * Moves cards between collections. The receiver gets a new PRIVATE item with
   * the trade value as cost basis; the giver's item is decremented or removed.
   * Trade snapshots are untouched, so history never changes.
   */
  private async transferCards(tx: Tx, trade: TradeDetail): Promise<void> {
    await this.assertItemsAvailable(tx, trade);
    const purchaseDate = startOfUtcDay(new Date());

    for (const giver of trade.participants) {
      const receiver = trade.participants.find((p) => p.id !== giver.id);
      if (!receiver) throw new Error('Trade is missing a participant');

      for (const line of giver.items) {
        const source = await tx.collectionItem.findUniqueOrThrow({ where: { id: line.collectionItemId as string } });
        await this.maintenance.removeCollectionItemFromOpenTrades(tx, source.id, trade.id);

        if (source.quantity === line.quantity) {
          await tx.collectionItem.delete({ where: { id: source.id } });
        } else {
          await tx.collectionItem.update({ where: { id: source.id }, data: { quantity: { decrement: line.quantity } } });
        }

        await tx.collectionItem.create({
          data: {
            userId: receiver.userId,
            cardId: source.cardId,
            quantity: line.quantity,
            condition: source.condition,
            gradingCompany: source.gradingCompany,
            grade: source.grade,
            certNumber: source.certNumber,
            priceTierKey: source.priceTierKey,
            purchasePriceCents: line.unitValueCents,
            purchaseDate,
            notes: null,
            listingStatus: 'PERSONAL',
            estimatedValueCents: source.estimatedValueCents,
            valueUpdatedAt: source.valueUpdatedAt,
          },
        });
      }
    }
  }
}

function toJsonComps(comps: CompSale[]): Prisma.InputJsonArray {
  return comps.map((c) => ({ priceCents: c.priceCents, soldAt: c.soldAt, source: c.source }));
}
