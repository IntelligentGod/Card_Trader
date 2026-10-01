import type { EventDetail, EventSearchResult, EventVendorResponse, MeResponse, Paginated } from '@card-trader/shared';
import { EventReminderService } from '../src/modules/events/event-reminder.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { API, auth, createCard, createTestApp, registerUser, resetDatabase, type TestContext, type TestUser } from './utils';

const HOUR = 3_600_000;

describe('events, vendors and Search This Event (e2e)', () => {
  let ctx: TestContext;
  let organizer: TestUser;
  let vendor: TestUser;
  let rival: TestUser;
  let collector: TestUser;
  let event: EventDetail;
  let application: EventVendorResponse;
  let listedSlab: string;
  let listedRaw: string;
  let personalCard: string;

  const addItem = async (user: TestUser, body: Record<string, unknown>) =>
    (await ctx.http().post(`${API}/collection`).set(auth(user)).send(body).expect(201)).body.id as string;

  const inbox = async (user: TestUser) =>
    (await ctx.http().get(`${API}/notifications`).set(auth(user)).expect(200)).body.data as { type: string }[];

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    organizer = await registerUser(ctx, 'Sam');
    vendor = await registerUser(ctx, 'Alex');
    rival = await registerUser(ctx, 'Riley');
    collector = await registerUser(ctx, 'Tom');

    const zoro = await createCard(ctx.prisma, { name: 'Zoro', category: 'ONE_PIECE', values: { 'GRADED:PSA:10': 90000 } });
    const luffy = await createCard(ctx.prisma, { name: 'Luffy', category: 'ONE_PIECE', values: { 'RAW:NEAR_MINT': 1200 } });
    listedSlab = await addItem(vendor, { cardId: zoro, condition: 'GRADED', gradingCompany: 'PSA', grade: 10, certNumber: '90887766', listingStatus: 'FOR_TRADE' });
    listedRaw = await addItem(vendor, { cardId: luffy, condition: 'NEAR_MINT', quantity: 4, listingStatus: 'FOR_SALE', askingPriceCents: 900 });
    personalCard = await addItem(vendor, { cardId: luffy, condition: 'MINT', listingStatus: 'PERSONAL' });
  });

  afterAll(async () => ctx.app.close());

  it('organizers create drafts that only they can see, then publish', async () => {
    const startsAt = new Date(Date.now() + 10 * 24 * HOUR).toISOString();
    const endsAt = new Date(Date.now() + 10 * 24 * HOUR + 8 * HOUR).toISOString();
    event = (
      await ctx
        .http()
        .post(`${API}/events`)
        .set(auth(organizer))
        .send({
          title: 'Austin Card Show',
          startsAt,
          endsAt,
          venueName: 'Palmer Events Center',
          city: 'Austin',
          region: 'TX',
          admission: '$10',
          socialLinks: { instagram: '@txcardshows', website: 'https://example.com' },
        })
        .expect(201)
    ).body;
    expect(event).toMatchObject({ status: 'DRAFT', isOrganizer: true, organizerDisplayName: 'Sam', approvedVendorCount: 0 });

    await ctx.http().get(`${API}/events/${event.id}`).set(auth(collector)).expect(404);
    await ctx
      .http()
      .post(`${API}/events`)
      .set(auth(organizer))
      .send({ title: 'Backwards', startsAt: endsAt, endsAt: startsAt, venueName: 'Hall', city: 'Austin' })
      .expect(400)
      .expect((r) => expect(r.body.code).toBe('INVALID_SCHEDULE'));

    event = (await ctx.http().post(`${API}/events/${event.id}/publish`).set(auth(organizer)).expect(200)).body;
    expect(event.status).toBe('PUBLISHED');
    const upcoming = await ctx.http().get(`${API}/events`).set(auth(collector)).expect(200);
    expect(upcoming.body.data.map((e: EventDetail) => e.id)).toContain(event.id);
  });

  it('Join as Vendor requires Vendor Mode; the organizer is notified', async () => {
    await ctx
      .http()
      .post(`${API}/events/${event.id}/vendors/apply`)
      .set(auth(vendor))
      .send({})
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('VENDOR_MODE_REQUIRED'));

    const me = (
      await ctx
        .http()
        .put(`${API}/users/me/vendor`)
        .set(auth(vendor))
        .send({ isActive: true, businessName: 'Grand Line Cards', website: 'https://grandline.example.com' })
        .expect(200)
    ).body as MeResponse;
    expect(me.vendor).toMatchObject({ isActive: true, businessName: 'Grand Line Cards' });
    await ctx.http().put(`${API}/users/me/vendor`).set(auth(rival)).send({ isActive: true, businessName: 'Rival Cards' }).expect(200);

    const applied = (
      await ctx.http().post(`${API}/events/${event.id}/vendors/apply`).set(auth(vendor)).send({ message: 'Two tables if possible' }).expect(200)
    ).body as EventDetail;
    expect(applied.myApplication).toMatchObject({ status: 'PENDING', tableNumber: null });
    expect(applied.myVendorStatus).toBe('PENDING');
    await ctx.http().post(`${API}/events/${event.id}/vendors/apply`).set(auth(vendor)).send({}).expect(409);
    await ctx.http().post(`${API}/events/${event.id}/vendors/apply`).set(auth(rival)).send({}).expect(200);

    expect((await inbox(organizer)).map((n) => n.type)).toEqual(['VENDOR_APPLICATION', 'VENDOR_APPLICATION']);
    await ctx.http().get(`${API}/events/${event.id}/vendors`).set(auth(collector)).expect(404);
    const applications = (await ctx.http().get(`${API}/events/${event.id}/vendors`).set(auth(organizer)).expect(200))
      .body as EventVendorResponse[];
    expect(applications).toHaveLength(2);
    application = applications.find((a) => a.vendor.publicId === vendor.publicId)!;
    expect(application.vendorInfo?.businessName).toBe('Grand Line Cards');
  });

  it('organizers approve vendors with unique table numbers', async () => {
    const approved = (
      await ctx
        .http()
        .post(`${API}/events/${event.id}/vendors/${application.id}/approve`)
        .set(auth(organizer))
        .send({ tableNumber: '14' })
        .expect(200)
    ).body as EventVendorResponse;
    expect(approved).toMatchObject({ status: 'APPROVED', tableNumber: '14' });
    expect((await inbox(vendor))[0]).toMatchObject({ type: 'VENDOR_APPROVED' });

    const rivalApplication = (
      (await ctx.http().get(`${API}/events/${event.id}/vendors`).set(auth(organizer)).expect(200)).body as EventVendorResponse[]
    ).find((a) => a.vendor.publicId === rival.publicId)!;
    await ctx
      .http()
      .post(`${API}/events/${event.id}/vendors/${rivalApplication.id}/approve`)
      .set(auth(organizer))
      .send({ tableNumber: '14' })
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('TABLE_TAKEN'));
    await ctx.http().post(`${API}/events/${event.id}/vendors/${rivalApplication.id}/decline`).set(auth(organizer)).expect(200);
    expect((await inbox(rival))[0]).toMatchObject({ type: 'VENDOR_DECLINED' });
    await ctx
      .http()
      .post(`${API}/events/${event.id}/vendors/${application.id}/approve`)
      .set(auth(vendor))
      .send({ tableNumber: '1' })
      .expect(404);
  });

  it('approved vendors bring listed cards from their existing inventory', async () => {
    await ctx
      .http()
      .put(`${API}/events/${event.id}/inventory/me`)
      .set(auth(rival))
      .send({ collectionItemIds: [] })
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('NOT_APPROVED_VENDOR'));
    await ctx
      .http()
      .put(`${API}/events/${event.id}/inventory/me`)
      .set(auth(vendor))
      .send({ collectionItemIds: [listedSlab, personalCard] })
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('ITEM_NOT_LISTED'));

    const selection = await ctx
      .http()
      .put(`${API}/events/${event.id}/inventory/me`)
      .set(auth(vendor))
      .send({ collectionItemIds: [listedSlab, listedRaw] })
      .expect(200);
    expect(selection.body.collectionItemIds.sort()).toEqual([listedSlab, listedRaw].sort());

    const own = await ctx.http().get(`${API}/collection/${listedSlab}`).set(auth(vendor)).expect(200);
    expect(own.body.eventIds).toEqual([event.id]);
    const detail = (await ctx.http().get(`${API}/events/${event.id}`).set(auth(collector)).expect(200)).body as EventDetail;
    expect(detail).toMatchObject({ approvedVendorCount: 1, inventoryCount: 2 });
    expect(detail.vendors[0]).toMatchObject({ tableNumber: '14', vendorInfo: { businessName: 'Grand Line Cards' } });
  });

  it('Search This Event finds cards across vendors with table numbers and filters', async () => {
    const search = async (qs: string) =>
      ((await ctx.http().get(`${API}/events/${event.id}/search${qs}`).set(auth(collector)).expect(200)).body as Paginated<EventSearchResult>)
        .data;

    const all = await search('');
    expect(all).toHaveLength(2);
    const zoro = all.find((r) => r.item.card.name === 'Zoro')!;
    expect(zoro).toMatchObject({
      tableNumber: '14',
      priceCents: 90000,
      priceIsAsking: false,
      vendor: { publicId: vendor.publicId, vendorName: 'Grand Line Cards' },
      item: { certNumber: '90887766', listingStatus: 'FOR_TRADE' },
    });

    expect((await search('?q=luffy')).map((r) => r.item.card.name)).toEqual(['Luffy']);
    expect((await search('?forSale=true')).map((r) => r.priceCents)).toEqual([900]);
    expect((await search('?kind=GRADED&grader=PSA&grade=10')).map((r) => r.item.card.name)).toEqual(['Zoro']);
    expect((await search('?kind=RAW&condition=NEAR_MINT')).map((r) => r.item.card.name)).toEqual(['Luffy']);
    expect(await search('?minPriceCents=1000&maxPriceCents=5000')).toHaveLength(0);
    expect((await search('?category=ONE_PIECE&forTrade=true')).map((r) => r.item.card.name)).toEqual(['Zoro']);
    await ctx.http().get(`${API}/events/${event.id}/search?forSale=yes`).set(auth(collector)).expect(400);

    // Find & Trade: start a trade from a result, linked to the show.
    const trade = await ctx
      .http()
      .post(`${API}/trades`)
      .set(auth(collector))
      .send({ counterpartyPublicId: vendor.publicId, eventId: event.id })
      .expect(201);
    expect(trade.body.event).toEqual({ id: event.id, title: 'Austin Card Show' });
    await ctx.http().post(`${API}/trades/${trade.body.id}/items`).set(auth(collector)).send({ collectionItemId: listedRaw }).expect(201);
  });

  it('vendor profiles list the upcoming shows they are approved for', async () => {
    const shows = await ctx.http().get(`${API}/events?vendor=${vendor.publicId}`).set(auth(collector)).expect(200);
    expect(shows.body.data.map((e: EventDetail) => e.id)).toEqual([event.id]);
    const profile = await ctx.http().get(`${API}/users/${vendor.publicId}`).set(auth(collector)).expect(200);
    expect(profile.body.vendor).toMatchObject({ businessName: 'Grand Line Cards' });

    // Switching Vendor Mode off hides the business details, not the account.
    await ctx.http().put(`${API}/users/me/vendor`).set(auth(rival)).send({ isActive: false, businessName: 'Rival Cards' }).expect(200);
    const rivalProfile = await ctx.http().get(`${API}/users/${rival.publicId}`).set(auth(collector)).expect(200);
    expect(rivalProfile.body.vendor).toBeNull();
  });

  it('notifies interested attendees and vendors about updates, reminders and cancellation', async () => {
    await ctx.http().put(`${API}/events/${event.id}/save`).set(auth(collector)).expect(200);
    const mine = await ctx.http().get(`${API}/events?scope=mine`).set(auth(collector)).expect(200);
    expect(mine.body.data[0]).toMatchObject({ id: event.id, isSaved: true });

    // Cosmetic edits are silent; logistics changes notify.
    await ctx.http().patch(`${API}/events/${event.id}`).set(auth(organizer)).send({ description: 'More tables!' }).expect(200);
    expect((await inbox(collector)).some((n) => n.type === 'EVENT_UPDATED')).toBe(false);
    const soon = new Date(Date.now() + 5 * HOUR);
    await ctx
      .http()
      .patch(`${API}/events/${event.id}`)
      .set(auth(organizer))
      .send({ startsAt: soon.toISOString(), endsAt: new Date(soon.getTime() + 8 * HOUR).toISOString() })
      .expect(200);
    expect((await inbox(collector))[0]).toMatchObject({ type: 'EVENT_UPDATED' });

    const reminders = new EventReminderService(ctx.prisma, new NotificationsService(ctx.prisma));
    expect(await reminders.run()).toBe(1);
    expect(await reminders.run()).toBe(0);
    expect((await inbox(collector))[0]).toMatchObject({ type: 'EVENT_REMINDER' });
    expect((await inbox(vendor))[0]).toMatchObject({ type: 'EVENT_REMINDER' });

    await ctx.http().post(`${API}/events/${event.id}/cancel`).set(auth(organizer)).expect(200);
    expect((await inbox(collector))[0]).toMatchObject({ type: 'EVENT_CANCELLED' });
    expect((await inbox(vendor))[0]).toMatchObject({ type: 'EVENT_CANCELLED' });
    await ctx.http().get(`${API}/events/${event.id}/search`).set(auth(collector)).expect(409);
  });
});
