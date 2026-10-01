import { Injectable } from '@nestjs/common';
import type { Event, EventVendor, Prisma } from '@prisma/client';
import type {
  EventDetail,
  EventSearchResult,
  EventSummary,
  EventVendorResponse,
} from '@card-trader/shared';
import { toIso } from '../../common/utils/dates';
import { readSocialLinks } from '../../common/validation/social-links';
import { CollectionMapper } from '../collection/collection.mapper';
import { publicUserSelect, UserMapper, type PublicUserSource } from '../users/user.mapper';

/** Everything a summary needs, relative to one viewer. */
export function eventSummaryInclude(viewerId: string) {
  return {
    organizer: { select: publicUserSelect },
    saves: { where: { userId: viewerId }, select: { userId: true } },
    vendors: { where: { vendorId: viewerId }, select: { status: true } },
    _count: { select: { vendors: { where: { status: 'APPROVED' } } } },
  } satisfies Prisma.EventInclude;
}

export type EventSummaryRow = Prisma.EventGetPayload<{ include: ReturnType<typeof eventSummaryInclude> }>;

export const eventVendorInclude = {
  vendor: { select: publicUserSelect },
  _count: { select: { inventory: true } },
} satisfies Prisma.EventVendorInclude;

export type EventVendorRow = EventVendor & {
  vendor: PublicUserSource;
  _count: { inventory: number };
};

export const searchResultInclude = (eventId: string) =>
  ({
    card: { include: { set: true } },
    user: { select: publicUserSelect },
    eventInventory: {
      where: { eventVendor: { eventId } },
      select: { eventVendor: { select: { tableNumber: true } } },
    },
  }) satisfies Prisma.CollectionItemInclude;

export type SearchResultRow = Prisma.CollectionItemGetPayload<{ include: ReturnType<typeof searchResultInclude> }>;

@Injectable()
export class EventMapper {
  constructor(
    private readonly users: UserMapper,
    private readonly collection: CollectionMapper,
  ) {}

  toSummary(event: EventSummaryRow, viewerId: string): EventSummary {
    return {
      id: event.id,
      title: event.title,
      status: event.status,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      venueName: event.venueName,
      city: event.city,
      region: event.region,
      admission: event.admission,
      organizerDisplayName: event.organizerName ?? event.organizer.profile?.displayName ?? 'Organizer',
      approvedVendorCount: event._count.vendors,
      isSaved: event.saves.length > 0,
      isOrganizer: event.organizerId === viewerId,
      myVendorStatus: event.vendors[0]?.status ?? null,
    };
  }

  toDetail(
    event: EventSummaryRow & Pick<Event, 'description' | 'address' | 'country' | 'website' | 'socialLinks'>,
    viewerId: string,
    extra: {
      vendors: EventVendorRow[];
      myApplication: EventVendorRow | null;
      pendingApplicationCount: number;
      inventoryCount: number;
    },
  ): EventDetail {
    return {
      ...this.toSummary(event, viewerId),
      description: event.description,
      address: event.address,
      country: event.country,
      website: event.website,
      socialLinks: readSocialLinks(event.socialLinks),
      organizer: this.users.toLite(event.organizer),
      vendors: extra.vendors.map((v) => this.toVendor(v)),
      myApplication: extra.myApplication ? this.toVendor(extra.myApplication) : null,
      pendingApplicationCount: extra.pendingApplicationCount,
      inventoryCount: extra.inventoryCount,
    };
  }

  toVendor(row: EventVendorRow): EventVendorResponse {
    return {
      id: row.id,
      status: row.status,
      tableNumber: row.tableNumber,
      message: row.message,
      vendor: this.users.toLite(row.vendor),
      vendorInfo: this.users.toPublicVendor(row.vendor.vendorProfile),
      inventoryCount: row._count.inventory,
      createdAt: row.createdAt.toISOString(),
      decidedAt: toIso(row.decidedAt),
    };
  }

  toSearchResult(row: SearchResultRow): EventSearchResult {
    const priceIsAsking = row.askingPriceCents !== null;
    return {
      item: this.collection.toPublic(row),
      vendor: this.users.toLite(row.user),
      vendorInfo: this.users.toPublicVendor(row.user.vendorProfile),
      tableNumber: row.eventInventory[0]?.eventVendor.tableNumber ?? null,
      priceCents: priceIsAsking ? row.askingPriceCents : row.estimatedValueCents,
      priceIsAsking,
    };
  }
}
