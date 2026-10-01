import { Injectable } from '@nestjs/common';
import { Prisma, type CollectionItem } from '@prisma/client';
import {
  ACTIVE_TRADE_STATUSES,
  InvalidPriceTierError,
  PUBLIC_LISTING_STATUSES,
  type ListingStatus,
  tierFromInput,
  tierKey,
  type CardValueHistoryResponse,
  type CollectionItemResponse,
  type CollectionSort,
  type MarketValueResponse,
  type Paginated,
  type PublicCollectionItem,
  type ValueRange,
} from '@card-trader/shared';
import { Errors } from '../../common/errors/app.exception';
import { pageArgs, toPage } from '../../common/pagination/pagination';
import { startOfUtcDay } from '../../common/utils/dates';
import { decimalToNumber } from '../../common/utils/decimal';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import { CardsService } from '../cards/cards.service';
import { PriceTrackingService } from '../pricing/price-tracking.service';
import { PricingReadService } from '../pricing/pricing-read.service';
import { TradeMaintenanceService } from '../trades/trade-maintenance.service';
import { StorageService } from '../uploads/storage.service';
import type { PublicCollectionQueryDto } from '../users/dto/users.dto';
import { UsersService } from '../users/users.service';
import { collectionItemInclude, CollectionMapper, type CollectionItemWithRelations } from './collection.mapper';
import type { CollectionQueryDto, CreateCollectionItemDto, UpdateCollectionItemDto } from './dto/collection.dto';

function orderByFor(sort: CollectionSort | undefined): Prisma.CollectionItemOrderByWithRelationInput[] {
  switch (sort) {
    case 'value_desc':
      return [{ estimatedValueCents: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }];
    case 'value_asc':
      return [{ estimatedValueCents: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }];
    case 'name':
      return [{ card: { name: 'asc' } }, { id: 'asc' }];
    case 'newest':
    default:
      return [{ createdAt: 'desc' }, { id: 'desc' }];
  }
}

function searchFilter(q: string | undefined): Prisma.CollectionItemWhereInput {
  if (!q) return {};
  return {
    card: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { cardNumber: { equals: q, mode: 'insensitive' } },
        { set: { name: { contains: q, mode: 'insensitive' } } },
      ],
    },
  };
}

/** Other users only ever see cards listed for trade and/or sale. */
function listingStatusesFor(availability: 'trade' | 'sale' | undefined): ListingStatus[] {
  if (availability === 'trade') return ['FOR_TRADE', 'TRADE_AND_SALE'];
  if (availability === 'sale') return ['FOR_SALE', 'TRADE_AND_SALE'];
  return [...PUBLIC_LISTING_STATUSES];
}

function parsePurchaseDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined || value === null) return value;
  const date = startOfUtcDay(new Date(value));
  if (Number.isNaN(date.getTime())) throw Errors.badRequest('INVALID_DATE', 'Invalid purchase date');
  if (date > new Date()) throw Errors.badRequest('INVALID_DATE', 'Purchase date cannot be in the future');
  return date;
}

@Injectable()
export class CollectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: CollectionMapper,
    private readonly cards: CardsService,
    private readonly tracking: PriceTrackingService,
    private readonly pricing: PricingReadService,
    private readonly trades: TradeMaintenanceService,
    private readonly storage: StorageService,
    private readonly users: UsersService,
  ) {}

  // ───────────── Own collection ─────────────

  async list(userId: string, query: CollectionQueryDto): Promise<Paginated<CollectionItemResponse>> {
    const rows = await this.prisma.collectionItem.findMany({
      where: {
        userId,
        ...(query.listingStatus && { listingStatus: query.listingStatus }),
        ...(query.category && { card: { category: query.category } }),
        ...searchFilter(query.q),
      },
      include: collectionItemInclude,
      orderBy: orderByFor(query.sort),
      ...pageArgs(query),
    });
    return toPage(rows, query, (row) => this.mapper.toResponse(row));
  }

  async get(userId: string, id: string): Promise<CollectionItemResponse> {
    return this.mapper.toResponse(await this.requireOwned(this.prisma, userId, id));
  }

  async create(userId: string, dto: CreateCollectionItemDto): Promise<CollectionItemResponse> {
    await this.cards.requireVisible(userId, dto.cardId);
    const tier = this.tierOrThrow({ condition: dto.condition, gradingCompany: dto.gradingCompany, grade: dto.grade });
    const quantity = dto.quantity ?? 1;
    if (tier.kind === 'GRADED' && quantity !== 1) {
      throw Errors.badRequest('GRADED_QUANTITY', 'Each graded slab is tracked individually (quantity 1)');
    }
    this.assertImageKey(userId, dto.customImageKey);
    this.assertImageKey(userId, dto.backImageKey);
    const key = tierKey(tier);

    const created = await this.prisma.$transaction(async (tx) => {
      const value = await this.tracking.currentValue(dto.cardId, key, tx);
      const item = await tx.collectionItem.create({
        data: {
          userId,
          cardId: dto.cardId,
          quantity,
          condition: dto.condition,
          gradingCompany: tier.kind === 'GRADED' ? tier.company : null,
          grade: tier.kind === 'GRADED' ? new Prisma.Decimal(tier.grade) : null,
          certNumber: tier.kind === 'GRADED' ? (dto.certNumber ?? null) : null,
          priceTierKey: key,
          purchasePriceCents: dto.purchasePriceCents ?? null,
          purchaseDate: parsePurchaseDate(dto.purchaseDate) ?? null,
          notes: dto.notes ?? null,
          customImageKey: dto.customImageKey ?? null,
          backImageKey: dto.backImageKey ?? null,
          listingStatus: dto.listingStatus ?? 'PERSONAL',
          askingPriceCents: dto.askingPriceCents ?? null,
          estimatedValueCents: value?.valueCents ?? null,
          valueUpdatedAt: value?.computedAt ?? null,
        },
        include: collectionItemInclude,
      });
      await this.tracking.ensureTracked(dto.cardId, key, tx);
      return item;
    });
    return this.mapper.toResponse(created);
  }

  async update(userId: string, id: string, dto: UpdateCollectionItemDto): Promise<CollectionItemResponse> {
    this.assertImageKey(userId, dto.customImageKey);
    this.assertImageKey(userId, dto.backImageKey);

    const updated = await this.prisma.$transaction(async (tx) => {
      const item = await this.requireOwned(tx, userId, id);

      // Changing condition clears grading fields unless they are sent again.
      const condition = dto.condition ?? item.condition;
      const conditionChanged = dto.condition !== undefined && dto.condition !== item.condition;
      const gradingCompany =
        dto.gradingCompany !== undefined ? dto.gradingCompany : conditionChanged ? null : item.gradingCompany;
      const grade = dto.grade !== undefined ? dto.grade : conditionChanged ? null : decimalToNumber(item.grade);
      const tier = this.tierOrThrow({ condition, gradingCompany, grade });
      const newKey = tierKey(tier);
      const quantity = dto.quantity ?? item.quantity;
      if (tier.kind === 'GRADED' && quantity !== 1) {
        throw Errors.badRequest('GRADED_QUANTITY', 'Each graded slab is tracked individually (quantity 1)');
      }

      const termsChanged = newKey !== item.priceTierKey || quantity !== item.quantity;
      if (termsChanged && (await this.isInActiveTrade(tx, item.id))) {
        throw Errors.conflict(
          'ITEM_IN_ACTIVE_TRADE',
          'Remove this card from your open trades before changing its condition, grade or quantity',
        );
      }

      let valueFields: Pick<CollectionItem, 'estimatedValueCents' | 'valueUpdatedAt'> | Record<string, never> = {};
      if (newKey !== item.priceTierKey) {
        const value = await this.tracking.currentValue(item.cardId, newKey, tx);
        valueFields = { estimatedValueCents: value?.valueCents ?? null, valueUpdatedAt: value?.computedAt ?? null };
        await this.tracking.ensureTracked(item.cardId, newKey, tx);
      }

      const result = await tx.collectionItem.update({
        where: { id: item.id },
        data: {
          quantity,
          condition,
          gradingCompany: tier.kind === 'GRADED' ? tier.company : null,
          grade: tier.kind === 'GRADED' ? new Prisma.Decimal(tier.grade) : null,
          priceTierKey: newKey,
          ...(tier.kind !== 'GRADED' && { certNumber: null }),
          ...(tier.kind === 'GRADED' && dto.certNumber !== undefined && { certNumber: dto.certNumber }),
          ...(dto.purchasePriceCents !== undefined && { purchasePriceCents: dto.purchasePriceCents }),
          ...(dto.purchaseDate !== undefined && { purchaseDate: parsePurchaseDate(dto.purchaseDate) }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.customImageKey !== undefined && { customImageKey: dto.customImageKey }),
          ...(dto.backImageKey !== undefined && { backImageKey: dto.backImageKey }),
          ...(dto.listingStatus !== undefined && { listingStatus: dto.listingStatus }),
          ...(dto.askingPriceCents !== undefined && { askingPriceCents: dto.askingPriceCents }),
          ...valueFields,
        },
        include: collectionItemInclude,
      });
      // A personal card is not on offer, so it cannot be "brought" to a show either.
      if (dto.listingStatus === 'PERSONAL' && result.eventInventory.length > 0) {
        await tx.eventInventoryItem.deleteMany({ where: { collectionItemId: item.id } });
        result.eventInventory = [];
      }
      return { result, previous: item };
    });

    for (const field of ['customImageKey', 'backImageKey'] as const) {
      const previousKey = updated.previous[field];
      if (dto[field] !== undefined && previousKey && previousKey !== dto[field]) await this.storage.delete(previousKey);
    }
    return this.mapper.toResponse(updated.result);
  }

  async remove(userId: string, id: string): Promise<void> {
    const imageKey = await this.prisma.$transaction(async (tx) => {
      const item = await this.requireOwned(tx, userId, id);
      if (item.tradeItems.length > 0) {
        throw Errors.conflict('ITEM_LOCKED_IN_TRADE', 'This card is committed to an accepted trade');
      }
      await this.trades.removeCollectionItemFromOpenTrades(tx, item.id);
      await tx.collectionItem.delete({ where: { id: item.id } });
      return [item.customImageKey, item.backImageKey];
    });
    for (const key of imageKey) if (key) await this.storage.delete(key);
  }

  async priceHistory(userId: string, id: string, range: ValueRange): Promise<CardValueHistoryResponse> {
    const item = await this.requireOwned(this.prisma, userId, id);
    return this.pricing.valueHistory(item.cardId, item.priceTierKey, range);
  }

  async marketValue(userId: string, id: string): Promise<MarketValueResponse> {
    const item = await this.requireOwned(this.prisma, userId, id);
    return this.pricing.marketValueFor(item.cardId, item.priceTierKey);
  }

  // ───────────── Other users' collections ─────────────

  async listPublic(publicId: string, query: PublicCollectionQueryDto): Promise<Paginated<PublicCollectionItem>> {
    const owner = await this.users.findActiveByPublicId(publicId);
    const rows = await this.prisma.collectionItem.findMany({
      where: {
        userId: owner.id,
        listingStatus: { in: listingStatusesFor(query.availability) },
        ...(query.category && { card: { category: query.category } }),
        ...searchFilter(query.q),
      },
      include: { card: { include: { set: true } } },
      orderBy: orderByFor(query.sort ?? 'value_desc'),
      ...pageArgs(query),
    });
    return toPage(rows, query, (row) => this.mapper.toPublic(row));
  }

  // ───────────── Helpers ─────────────

  /** Ownership is part of the query: another user's id yields 404, never 403 (IDOR-safe). */
  private async requireOwned(tx: Tx, userId: string, id: string): Promise<CollectionItemWithRelations> {
    const item = await tx.collectionItem.findFirst({ where: { id, userId }, include: collectionItemInclude });
    if (!item) throw Errors.notFound('COLLECTION_ITEM_NOT_FOUND', 'Card not found in your collection');
    return item;
  }

  private async isInActiveTrade(tx: Tx, collectionItemId: string): Promise<boolean> {
    const count = await tx.tradeItem.count({
      where: { collectionItemId, trade: { status: { in: [...ACTIVE_TRADE_STATUSES] } } },
    });
    return count > 0;
  }

  private tierOrThrow(input: Parameters<typeof tierFromInput>[0]) {
    try {
      return tierFromInput(input);
    } catch (error) {
      if (error instanceof InvalidPriceTierError) throw Errors.badRequest('INVALID_GRADING', error.message);
      throw error;
    }
  }

  private assertImageKey(userId: string, key: string | null | undefined): void {
    if (key && !this.storage.isOwnedKey(key, 'ITEM_IMAGE', userId)) {
      throw Errors.badRequest('INVALID_IMAGE_KEY', 'Upload the image first and use the returned key');
    }
  }
}
