import { Injectable } from '@nestjs/common';
import type { CollectionItem, Prisma } from '@prisma/client';
import { tierLabelFromKey, type CollectionItemResponse, type PublicCollectionItem } from '@card-trader/shared';
import { decimalToNumber } from '../../common/utils/decimal';
import { toDateString, toIso } from '../../common/utils/dates';
import { toCardSummary, type CardWithSet } from '../cards/card.mapper';
import { StorageService } from '../uploads/storage.service';

export const collectionItemInclude = {
  card: { include: { set: true } },
  tradeItems: { where: { trade: { status: 'ACCEPTED' } }, select: { id: true } },
  eventInventory: { select: { eventVendor: { select: { eventId: true } } } },
} satisfies Prisma.CollectionItemInclude;

export type CollectionItemWithRelations = CollectionItem & {
  card: CardWithSet;
  tradeItems: { id: string }[];
  eventInventory: { eventVendor: { eventId: string } }[];
};

function totalValue(item: CollectionItem): number | null {
  return item.estimatedValueCents === null ? null : item.estimatedValueCents * item.quantity;
}

@Injectable()
export class CollectionMapper {
  constructor(private readonly storage: StorageService) {}

  toResponse(item: CollectionItemWithRelations): CollectionItemResponse {
    return {
      id: item.id,
      card: toCardSummary(item.card),
      quantity: item.quantity,
      condition: item.condition,
      gradingCompany: item.gradingCompany,
      grade: decimalToNumber(item.grade),
      certNumber: item.certNumber,
      tierKey: item.priceTierKey,
      tierLabel: tierLabelFromKey(item.priceTierKey),
      purchasePriceCents: item.purchasePriceCents,
      purchaseDate: item.purchaseDate ? toDateString(item.purchaseDate) : null,
      notes: item.notes,
      imageUrl: this.storage.urlFor(item.customImageKey) ?? item.card.imageUrl,
      customImageKey: item.customImageKey,
      backImageUrl: this.storage.urlFor(item.backImageKey),
      backImageKey: item.backImageKey,
      listingStatus: item.listingStatus,
      askingPriceCents: item.askingPriceCents,
      estimatedValueCents: item.estimatedValueCents,
      totalValueCents: totalValue(item),
      valueUpdatedAt: toIso(item.valueUpdatedAt),
      lockedInTrade: item.tradeItems.length > 0,
      eventIds: item.eventInventory.map((e) => e.eventVendor.eventId),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  /**
   * Other users never see purchase price, notes, or dates. The cert number is
   * printed on the slab and lets a buyer verify it, so it is shown.
   */
  toPublic(item: CollectionItem & { card: CardWithSet }): PublicCollectionItem {
    return {
      id: item.id,
      card: toCardSummary(item.card),
      quantity: item.quantity,
      condition: item.condition,
      gradingCompany: item.gradingCompany,
      grade: decimalToNumber(item.grade),
      certNumber: item.certNumber,
      tierKey: item.priceTierKey,
      tierLabel: tierLabelFromKey(item.priceTierKey),
      imageUrl: this.storage.urlFor(item.customImageKey) ?? item.card.imageUrl,
      backImageUrl: this.storage.urlFor(item.backImageKey),
      listingStatus: item.listingStatus,
      askingPriceCents: item.askingPriceCents,
      estimatedValueCents: item.estimatedValueCents,
      totalValueCents: totalValue(item),
    };
  }
}
