import { Injectable } from '@nestjs/common';
import { Prisma, type Event, type EventVendor } from '@prisma/client';
import {
  PUBLIC_LISTING_STATUSES,
  type EventDetail,
  type EventInventorySelection,
  type EventSearchResult,
  type EventSummary,
  type EventVendorResponse,
  type ListingStatus,
  type Paginated,
} from '@card-trader/shared';
import { Errors } from '../../common/errors/app.exception';
import { pageArgs, toPage } from '../../common/pagination/pagination';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import { NotificationsService, type NotificationInput } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import type {
  ApplyAsVendorDto,
  ApproveVendorDto,
  CreateEventDto,
  EventListQueryDto,
  EventSearchQueryDto,
  SetEventInventoryDto,
  UpdateEventDto,
} from './dto/events.dto';
import {
  EventMapper,
  eventSummaryInclude,
  eventVendorInclude,
  searchResultInclude,
  type EventVendorRow,
} from './event.mapper';

export const MAX_EVENT_DAYS = 14;
export const MAX_UPCOMING_EVENTS_PER_ORGANIZER = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Card shows. Any user can organize; the creator is the organizer.
 *
 *   Event:        DRAFT ──publish──▶ PUBLISHED ──cancel──▶ CANCELLED
 *   Application:  PENDING ──approve(table)──▶ APPROVED ──decline──▶ DECLINED
 *                 PENDING|APPROVED ──withdraw (vendor)──▶ WITHDRAWN (may re-apply)
 *
 * Drafts are visible only to their organizer (404 for everyone else). Event
 * inventory is a set of pointers into the vendor's existing collection.
 */
@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: EventMapper,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
  ) {}

  // ───────────── Browsing ─────────────

  async list(viewerId: string, query: EventListQueryDto): Promise<Paginated<EventSummary>> {
    const now = new Date();
    const search: Prisma.EventWhereInput = query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: 'insensitive' } },
            { venueName: { contains: query.q, mode: 'insensitive' } },
            { city: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};

    let where: Prisma.EventWhereInput;
    let orderBy: Prisma.EventOrderByWithRelationInput[] = [{ startsAt: 'asc' }, { id: 'asc' }];
    if (query.vendor) {
      const vendor = await this.users.findActiveByPublicId(query.vendor);
      where = {
        status: 'PUBLISHED',
        endsAt: { gte: now },
        vendors: { some: { vendorId: vendor.id, status: 'APPROVED' } },
      };
    } else if (query.scope === 'organizing') {
      where = { organizerId: viewerId };
      orderBy = [{ startsAt: 'desc' }, { id: 'desc' }];
    } else if (query.scope === 'mine') {
      where = {
        status: { in: ['PUBLISHED', 'CANCELLED'] },
        endsAt: { gte: new Date(now.getTime() - DAY_MS) },
        OR: [
          { saves: { some: { userId: viewerId } } },
          { vendors: { some: { vendorId: viewerId, status: { in: ['PENDING', 'APPROVED'] } } } },
        ],
      };
    } else {
      where = { status: 'PUBLISHED', endsAt: { gte: now } };
    }

    const rows = await this.prisma.event.findMany({
      where: { AND: [where, search] },
      include: eventSummaryInclude(viewerId),
      orderBy,
      ...pageArgs(query),
    });
    return toPage(rows, query, (row) => this.mapper.toSummary(row, viewerId));
  }

  async get(viewerId: string, eventId: string): Promise<EventDetail> {
    const event = await this.requireVisible(this.prisma, viewerId, eventId);
    const [vendors, myApplication, pendingApplicationCount, inventoryCount] = await Promise.all([
      this.prisma.eventVendor.findMany({
        where: { eventId, status: 'APPROVED' },
        include: eventVendorInclude,
        orderBy: [{ tableNumber: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.eventVendor.findUnique({
        where: { eventId_vendorId: { eventId, vendorId: viewerId } },
        include: eventVendorInclude,
      }),
      event.organizerId === viewerId
        ? this.prisma.eventVendor.count({ where: { eventId, status: 'PENDING' } })
        : Promise.resolve(0),
      this.prisma.eventInventoryItem.count({
        where: {
          eventVendor: { eventId, status: 'APPROVED' },
          collectionItem: { listingStatus: { in: [...PUBLIC_LISTING_STATUSES] } },
        },
      }),
    ]);
    return this.mapper.toDetail(event, viewerId, { vendors, myApplication, pendingApplicationCount, inventoryCount });
  }

  // ───────────── Organizer: events ─────────────

  async create(organizerId: string, dto: CreateEventDto): Promise<EventDetail> {
    const { startsAt, endsAt } = this.parseSchedule(dto.startsAt, dto.endsAt);
    const upcoming = await this.prisma.event.count({
      where: { organizerId, status: { not: 'CANCELLED' }, endsAt: { gte: new Date() } },
    });
    if (upcoming >= MAX_UPCOMING_EVENTS_PER_ORGANIZER) {
      throw Errors.conflict('TOO_MANY_EVENTS', 'You have too many upcoming events');
    }
    const event = await this.prisma.event.create({
      data: {
        organizerId,
        title: dto.title,
        description: dto.description ?? null,
        startsAt,
        endsAt,
        venueName: dto.venueName,
        address: dto.address ?? null,
        city: dto.city,
        region: dto.region ?? null,
        country: dto.country ?? 'US',
        admission: dto.admission ?? null,
        organizerName: dto.organizerName ?? null,
        website: dto.website ?? null,
        socialLinks: dto.socialLinks ?? {},
      },
      select: { id: true },
    });
    return this.get(organizerId, event.id);
  }

  async update(organizerId: string, eventId: string, dto: UpdateEventDto): Promise<EventDetail> {
    await this.prisma.$transaction(async (tx) => {
      const event = await this.requireOrganized(tx, organizerId, eventId);
      if (event.status === 'CANCELLED') throw Errors.conflict('EVENT_CANCELLED', 'A cancelled event cannot be edited');
      const schedule =
        dto.startsAt !== undefined || dto.endsAt !== undefined
          ? this.parseSchedule(dto.startsAt ?? event.startsAt.toISOString(), dto.endsAt ?? event.endsAt.toISOString())
          : null;

      const data: Prisma.EventUpdateInput = {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(schedule && { startsAt: schedule.startsAt, endsAt: schedule.endsAt }),
        ...(dto.venueName !== undefined && { venueName: dto.venueName }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.region !== undefined && { region: dto.region }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.admission !== undefined && { admission: dto.admission }),
        ...(dto.organizerName !== undefined && { organizerName: dto.organizerName }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.socialLinks !== undefined && { socialLinks: dto.socialLinks }),
        // A new start time deserves a new reminder.
        ...(schedule && schedule.startsAt.getTime() !== event.startsAt.getTime() && { reminderSentAt: null }),
      };
      await tx.event.update({ where: { id: event.id }, data });

      // Attendees and vendors only hear about changes to details they rely on.
      const logisticsChanged =
        (schedule !== null &&
          (schedule.startsAt.getTime() !== event.startsAt.getTime() || schedule.endsAt.getTime() !== event.endsAt.getTime())) ||
        (dto.venueName !== undefined && dto.venueName !== event.venueName) ||
        (dto.address !== undefined && dto.address !== event.address) ||
        (dto.city !== undefined && dto.city !== event.city) ||
        (dto.admission !== undefined && dto.admission !== event.admission);
      if (event.status === 'PUBLISHED' && logisticsChanged) {
        await this.notifyAudience(tx, event, 'EVENT_UPDATED', {
          title: 'Event updated',
          body: `${dto.title ?? event.title} changed its date, venue or admission. Check the details.`,
        });
      }
    });
    return this.get(organizerId, eventId);
  }

  async publish(organizerId: string, eventId: string): Promise<EventDetail> {
    await this.prisma.$transaction(async (tx) => {
      const event = await this.requireOrganized(tx, organizerId, eventId);
      if (event.status !== 'DRAFT') throw Errors.conflict('EVENT_NOT_DRAFT', 'Only a draft event can be published');
      if (event.endsAt < new Date()) throw Errors.conflict('EVENT_IN_PAST', 'This event has already ended');
      await tx.event.update({ where: { id: event.id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    });
    return this.get(organizerId, eventId);
  }

  async cancel(organizerId: string, eventId: string): Promise<EventDetail> {
    await this.prisma.$transaction(async (tx) => {
      const event = await this.requireOrganized(tx, organizerId, eventId);
      if (event.status === 'CANCELLED') throw Errors.conflict('EVENT_CANCELLED', 'This event is already cancelled');
      await tx.event.update({ where: { id: event.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
      if (event.status === 'PUBLISHED') {
        await this.notifyAudience(
          tx,
          event,
          'EVENT_CANCELLED',
          { title: 'Event cancelled', body: `${event.title} has been cancelled by the organizer.` },
          { includePendingVendors: true },
        );
      }
    });
    return this.get(organizerId, eventId);
  }

  // ───────────── Attendees ─────────────

  async setSaved(userId: string, eventId: string, saved: boolean): Promise<EventDetail> {
    const event = await this.requireVisible(this.prisma, userId, eventId);
    if (saved) {
      if (event.status !== 'PUBLISHED') throw Errors.conflict('EVENT_NOT_PUBLISHED', 'Only published events can be saved');
      await this.prisma.eventSave.upsert({
        where: { userId_eventId: { userId, eventId } },
        create: { userId, eventId },
        update: {},
      });
    } else {
      await this.prisma.eventSave.deleteMany({ where: { userId, eventId } });
    }
    return this.get(userId, eventId);
  }

  // ───────────── Vendors ─────────────

  async apply(vendorId: string, eventId: string, dto: ApplyAsVendorDto): Promise<EventDetail> {
    const vendor = await this.users.requireActive(vendorId);
    if (!vendor.vendorProfile?.isActive) {
      throw Errors.conflict('VENDOR_MODE_REQUIRED', 'Switch your profile to Vendor Mode before joining as a vendor');
    }
    await this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      if (!event || (event.status === 'DRAFT' && event.organizerId !== vendorId)) {
        throw Errors.notFound('EVENT_NOT_FOUND', 'Event not found');
      }
      if (event.status !== 'PUBLISHED') throw Errors.conflict('EVENT_NOT_PUBLISHED', 'This event is not accepting vendors');
      if (event.endsAt < new Date()) throw Errors.conflict('EVENT_IN_PAST', 'This event has already ended');

      const existing = await tx.eventVendor.findUnique({ where: { eventId_vendorId: { eventId, vendorId } } });
      if (existing && existing.status !== 'WITHDRAWN') {
        const message =
          existing.status === 'DECLINED'
            ? 'The organizer declined your application for this event'
            : 'You already applied to this event';
        throw Errors.conflict('ALREADY_APPLIED', message);
      }
      if (existing) {
        await tx.eventVendor.update({
          where: { id: existing.id },
          data: { status: 'PENDING', message: dto.message ?? null, decidedAt: null, tableNumber: null },
        });
      } else {
        await tx.eventVendor.create({ data: { eventId, vendorId, message: dto.message ?? null } });
      }
      await this.notifications.notify(tx, {
        userId: event.organizerId,
        type: 'VENDOR_APPLICATION',
        title: 'New vendor application',
        body: `${vendor.vendorProfile?.businessName ?? 'A vendor'} wants a table at ${event.title}.`,
        data: { eventId },
      });
    });
    return this.get(vendorId, eventId);
  }

  async withdraw(vendorId: string, eventId: string): Promise<EventDetail> {
    await this.prisma.$transaction(async (tx) => {
      const application = await tx.eventVendor.findUnique({ where: { eventId_vendorId: { eventId, vendorId } } });
      if (!application || !['PENDING', 'APPROVED'].includes(application.status)) {
        throw Errors.notFound('APPLICATION_NOT_FOUND', 'You have no active application for this event');
      }
      await tx.eventInventoryItem.deleteMany({ where: { eventVendorId: application.id } });
      await tx.eventVendor.update({
        where: { id: application.id },
        data: { status: 'WITHDRAWN', tableNumber: null, decidedAt: new Date() },
      });
    });
    return this.get(vendorId, eventId);
  }

  /** Organizer view: every application, pending first. */
  async listApplications(organizerId: string, eventId: string): Promise<EventVendorResponse[]> {
    await this.requireOrganized(this.prisma, organizerId, eventId);
    const rows = await this.prisma.eventVendor.findMany({
      where: { eventId, status: { not: 'WITHDRAWN' } },
      include: eventVendorInclude,
      orderBy: [{ createdAt: 'asc' }],
    });
    const rank: Record<EventVendor['status'], number> = { PENDING: 0, APPROVED: 1, DECLINED: 2, WITHDRAWN: 3 };
    return rows.sort((a, b) => rank[a.status] - rank[b.status]).map((row) => this.mapper.toVendor(row));
  }

  /** Approves an application (or re-assigns an approved vendor's table). */
  async approve(organizerId: string, eventId: string, applicationId: string, dto: ApproveVendorDto): Promise<EventVendorResponse> {
    const row = await this.decide(organizerId, eventId, applicationId, async (tx, application, event) => {
      if (application.status === 'WITHDRAWN') {
        throw Errors.conflict('APPLICATION_WITHDRAWN', 'The vendor withdrew this application');
      }
      const wasApproved = application.status === 'APPROVED';
      try {
        await tx.eventVendor.update({
          where: { id: application.id },
          data: { status: 'APPROVED', tableNumber: dto.tableNumber, decidedAt: new Date() },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw Errors.conflict('TABLE_TAKEN', `Table ${dto.tableNumber} is already assigned to another vendor`);
        }
        throw error;
      }
      await this.notifications.notify(tx, {
        userId: application.vendorId,
        type: 'VENDOR_APPROVED',
        title: wasApproved ? 'Table changed' : 'You are in!',
        body: wasApproved
          ? `Your table at ${event.title} is now ${dto.tableNumber}.`
          : `${event.title} approved you as a vendor — table ${dto.tableNumber}. Pick the cards you are bringing.`,
        data: { eventId },
      });
    });
    return row;
  }

  async decline(organizerId: string, eventId: string, applicationId: string): Promise<EventVendorResponse> {
    return this.decide(organizerId, eventId, applicationId, async (tx, application, event) => {
      if (!['PENDING', 'APPROVED'].includes(application.status)) {
        throw Errors.conflict('APPLICATION_NOT_OPEN', 'Only pending or approved applications can be declined');
      }
      await tx.eventInventoryItem.deleteMany({ where: { eventVendorId: application.id } });
      await tx.eventVendor.update({
        where: { id: application.id },
        data: { status: 'DECLINED', tableNumber: null, decidedAt: new Date() },
      });
      await this.notifications.notify(tx, {
        userId: application.vendorId,
        type: 'VENDOR_DECLINED',
        title: 'Vendor application declined',
        body: `${event.title} could not offer you a table this time.`,
        data: { eventId },
      });
    });
  }

  // ───────────── Event inventory ─────────────

  async getMyInventory(vendorId: string, eventId: string): Promise<EventInventorySelection> {
    const application = await this.requireApprovedVendor(this.prisma, vendorId, eventId);
    const rows = await this.prisma.eventInventoryItem.findMany({
      where: { eventVendorId: application.id },
      select: { collectionItemId: true },
    });
    return { collectionItemIds: rows.map((r) => r.collectionItemId) };
  }

  /** Replaces the "Bringing to this event" selection. Only listed cards the vendor owns. */
  async setMyInventory(vendorId: string, eventId: string, dto: SetEventInventoryDto): Promise<EventInventorySelection> {
    const ids = [...new Set(dto.collectionItemIds)];
    await this.prisma.$transaction(async (tx) => {
      const application = await this.requireApprovedVendor(tx, vendorId, eventId);
      const items = await tx.collectionItem.findMany({
        where: { id: { in: ids }, userId: vendorId },
        select: { id: true, listingStatus: true, card: { select: { name: true } } },
      });
      if (items.length !== ids.length) throw Errors.notFound('COLLECTION_ITEM_NOT_FOUND', 'Card not found in your inventory');
      const personal = items.find((i) => i.listingStatus === 'PERSONAL');
      if (personal) {
        throw Errors.conflict(
          'ITEM_NOT_LISTED',
          `${personal.card.name} is in your personal collection. Mark it For Trade or For Sale first.`,
        );
      }
      await tx.eventInventoryItem.deleteMany({
        where: { eventVendorId: application.id, collectionItemId: { notIn: ids } },
      });
      await tx.eventInventoryItem.createMany({
        data: ids.map((collectionItemId) => ({ eventVendorId: application.id, collectionItemId })),
        skipDuplicates: true,
      });
    });
    return this.getMyInventory(vendorId, eventId);
  }

  // ───────────── Search This Event ─────────────

  async search(viewerId: string, eventId: string, query: EventSearchQueryDto): Promise<Paginated<EventSearchResult>> {
    const event = await this.requireVisible(this.prisma, viewerId, eventId);
    if (event.status !== 'PUBLISHED') throw Errors.conflict('EVENT_NOT_PUBLISHED', 'This event is not open for search');

    const rows = await this.prisma.collectionItem.findMany({
      where: {
        eventInventory: { some: { eventVendor: { eventId, status: 'APPROVED' } } },
        listingStatus: { in: listingStatusesFor(query.forSale, query.forTrade) },
        user: { status: 'ACTIVE' },
        ...cardFilters(query),
        ...priceFilter(query.minPriceCents, query.maxPriceCents),
      },
      include: searchResultInclude(eventId),
      orderBy: [{ card: { name: 'asc' } }, { id: 'asc' }],
      ...pageArgs(query),
    });
    return toPage(rows, query, (row) => this.mapper.toSearchResult(row));
  }

  // ───────────── Internals ─────────────

  private parseSchedule(startsAtText: string, endsAtText: string): { startsAt: Date; endsAt: Date } {
    const startsAt = new Date(startsAtText);
    const endsAt = new Date(endsAtText);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw Errors.badRequest('INVALID_DATE', 'Invalid event date');
    }
    if (endsAt <= startsAt) throw Errors.badRequest('INVALID_SCHEDULE', 'The event must end after it starts');
    if (endsAt < new Date()) throw Errors.badRequest('INVALID_SCHEDULE', 'The event cannot end in the past');
    if (endsAt.getTime() - startsAt.getTime() > MAX_EVENT_DAYS * DAY_MS) {
      throw Errors.badRequest('INVALID_SCHEDULE', `An event can last at most ${MAX_EVENT_DAYS} days`);
    }
    return { startsAt, endsAt };
  }

  private async requireVisible(tx: Tx, viewerId: string, eventId: string) {
    const event = await tx.event.findUnique({ where: { id: eventId }, include: eventSummaryInclude(viewerId) });
    if (!event || (event.status === 'DRAFT' && event.organizerId !== viewerId)) {
      throw Errors.notFound('EVENT_NOT_FOUND', 'Event not found');
    }
    return event;
  }

  /** Non-organizers get 404, never 403, so drafts do not leak. */
  private async requireOrganized(tx: Tx, organizerId: string, eventId: string): Promise<Event> {
    const event = await tx.event.findFirst({ where: { id: eventId, organizerId } });
    if (!event) throw Errors.notFound('EVENT_NOT_FOUND', 'Event not found');
    return event;
  }

  private async lockEvent(tx: Tx, eventId: string): Promise<Event | null> {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`;
    return tx.event.findUnique({ where: { id: eventId } });
  }

  private async requireApprovedVendor(tx: Tx, vendorId: string, eventId: string): Promise<EventVendor> {
    const application = await tx.eventVendor.findUnique({ where: { eventId_vendorId: { eventId, vendorId } } });
    if (!application || application.status !== 'APPROVED') {
      throw Errors.conflict('NOT_APPROVED_VENDOR', 'Only approved vendors can choose cards for this event');
    }
    return application;
  }

  private async decide(
    organizerId: string,
    eventId: string,
    applicationId: string,
    action: (tx: Tx, application: EventVendor, event: Event) => Promise<void>,
  ): Promise<EventVendorResponse> {
    await this.prisma.$transaction(async (tx) => {
      const event = await this.requireOrganized(tx, organizerId, eventId);
      if (event.status === 'CANCELLED') throw Errors.conflict('EVENT_CANCELLED', 'This event is cancelled');
      await tx.$queryRaw`SELECT id FROM "EventVendor" WHERE id = ${applicationId}::uuid FOR UPDATE`;
      const application = await tx.eventVendor.findFirst({ where: { id: applicationId, eventId } });
      if (!application) throw Errors.notFound('APPLICATION_NOT_FOUND', 'Application not found');
      await action(tx, application, event);
    });
    const row: EventVendorRow = await this.prisma.eventVendor.findUniqueOrThrow({
      where: { id: applicationId },
      include: eventVendorInclude,
    });
    return this.mapper.toVendor(row);
  }

  /** Saved attendees + approved (optionally pending) vendors, never the organizer themselves. */
  private async notifyAudience(
    tx: Tx,
    event: Event,
    type: NotificationInput['type'],
    text: { title: string; body: string },
    options: { includePendingVendors?: boolean } = {},
  ): Promise<void> {
    const [saves, vendors] = await Promise.all([
      tx.eventSave.findMany({ where: { eventId: event.id }, select: { userId: true } }),
      tx.eventVendor.findMany({
        where: { eventId: event.id, status: { in: options.includePendingVendors ? ['PENDING', 'APPROVED'] : ['APPROVED'] } },
        select: { vendorId: true },
      }),
    ]);
    const userIds = new Set([...saves.map((s) => s.userId), ...vendors.map((v) => v.vendorId)]);
    userIds.delete(event.organizerId);
    await this.notifications.notify(
      tx,
      [...userIds].map((userId) => ({ userId, type, ...text, data: { eventId: event.id } })),
    );
  }
}

/** Both flags narrow the results: forSale AND forTrade means "open to either deal". */
function listingStatusesFor(forSale: boolean | undefined, forTrade: boolean | undefined): ListingStatus[] {
  return PUBLIC_LISTING_STATUSES.filter(
    (status) =>
      (!forSale || status === 'FOR_SALE' || status === 'TRADE_AND_SALE') &&
      (!forTrade || status === 'FOR_TRADE' || status === 'TRADE_AND_SALE'),
  );
}

function cardFilters(query: EventSearchQueryDto): Prisma.CollectionItemWhereInput {
  const card: Prisma.CardWhereInput = {
    ...(query.category && { category: query.category }),
    ...(query.q && {
      OR: [
        { name: { contains: query.q, mode: 'insensitive' } },
        { subject: { contains: query.q, mode: 'insensitive' } },
        { cardNumber: { equals: query.q, mode: 'insensitive' } },
        { set: { name: { contains: query.q, mode: 'insensitive' } } },
      ],
    }),
  };
  const set: Prisma.CardSetWhereInput = {
    ...(query.set && { name: { contains: query.set, mode: 'insensitive' } }),
    ...(query.year !== undefined && { year: query.year }),
  };
  if (Object.keys(set).length > 0) card.set = set;

  const graded = query.kind === 'GRADED' || query.grader !== undefined || query.grade !== undefined;
  return {
    ...(Object.keys(card).length > 0 && { card }),
    ...(query.kind === 'RAW' && { condition: { not: 'GRADED' } }),
    ...(graded && query.kind !== 'RAW' && { condition: 'GRADED' }),
    ...(query.condition && query.kind !== 'GRADED' && { condition: query.condition }),
    ...(query.grader && { gradingCompany: query.grader }),
    ...(query.grade !== undefined && { grade: new Prisma.Decimal(query.grade) }),
  };
}

/** Filters on the asking price when set, otherwise on the estimated value. */
function priceFilter(min: number | undefined, max: number | undefined): Prisma.CollectionItemWhereInput {
  if (min === undefined && max === undefined) return {};
  const range = { ...(min !== undefined && { gte: min }), ...(max !== undefined && { lte: max }) };
  return {
    OR: [
      { askingPriceCents: range },
      { askingPriceCents: null, estimatedValueCents: range },
    ],
  };
}
