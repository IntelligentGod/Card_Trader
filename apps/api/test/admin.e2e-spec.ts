import type {
  AdminOverview,
  AdminTradeDetail,
  AdminTradeListItem,
  AdminUserDetail,
  AdminUserListItem,
  CollectionItemResponse,
  MeResponse,
  Paginated,
} from '@card-trader/shared';
import { API, auth, createCard, createTestApp, registerUser, resetDatabase, type TestContext, type TestUser } from './utils';

describe('Admin console (e2e)', () => {
  let ctx: TestContext;
  let admin: TestUser;
  let alice: TestUser;
  let bob: TestUser;
  let tradeId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    [admin, alice, bob] = await Promise.all([
      registerUser(ctx, 'Admin'),
      registerUser(ctx, 'Alice'),
      registerUser(ctx, 'Bob'),
    ]);
    await ctx.prisma.user.update({ where: { id: admin.userId }, data: { role: 'ADMIN' } });

    const pikachu = await createCard(ctx.prisma, { name: 'Pikachu', values: { RAW: 5000 } });
    const add = (user: TestUser, listingStatus: string) =>
      ctx
        .http()
        .post(`${API}/collection`)
        .set(auth(user))
        .send({ cardId: pikachu, condition: 'RAW', listingStatus })
        .expect(201)
        .then((r) => r.body.id as string);
    await add(alice, 'PERSONAL');
    const aliceForTrade = await add(alice, 'FOR_TRADE');
    await add(bob, 'FOR_TRADE');

    const trade = await ctx.http().post(`${API}/trades`).set(auth(alice)).send({ counterpartyPublicId: bob.publicId }).expect(201);
    tradeId = trade.body.id;
    await ctx.http().post(`${API}/trades/${tradeId}/items`).set(auth(alice)).send({ collectionItemId: aliceForTrade }).expect(201);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('reports the role on /users/me', async () => {
    const me = await ctx.http().get(`${API}/users/me`).set(auth(admin)).expect(200);
    expect((me.body as MeResponse).role).toBe('ADMIN');
    const other = await ctx.http().get(`${API}/users/me`).set(auth(alice)).expect(200);
    expect((other.body as MeResponse).role).toBe('USER');
  });

  it('refuses everyone who is not an active admin', async () => {
    await ctx.http().get(`${API}/admin/overview`).expect(401);
    const res = await ctx.http().get(`${API}/admin/users`).set(auth(alice)).expect(403);
    expect(res.body.code).toBe('ADMIN_ONLY');
    await ctx.http().get(`${API}/admin/trades/${tradeId}`).set(auth(bob)).expect(403);
  });

  it('applies a revoked role on the next request, without a new token', async () => {
    await ctx.prisma.user.update({ where: { id: admin.userId }, data: { role: 'USER' } });
    await ctx.http().get(`${API}/admin/overview`).set(auth(admin)).expect(403);
    await ctx.prisma.user.update({ where: { id: admin.userId }, data: { role: 'ADMIN' } });
    await ctx.http().get(`${API}/admin/overview`).set(auth(admin)).expect(200);
  });

  it('summarises the whole app', async () => {
    const res = await ctx.http().get(`${API}/admin/overview`).set(auth(admin)).expect(200);
    const overview = res.body as AdminOverview;
    expect(overview.users).toMatchObject({ total: 3, active: 3, admins: 1 });
    expect(overview.collection).toMatchObject({ items: 3, cards: 3, totalValueCents: 15000 });
    expect(overview.trades.total).toBe(1);
    expect(overview.trades.byStatus.DRAFT).toBe(1);
  });

  it('lists and searches users, with private fields', async () => {
    const all = (await ctx.http().get(`${API}/admin/users`).set(auth(admin)).expect(200)).body as Paginated<AdminUserListItem>;
    expect(all.data).toHaveLength(3);

    const found = (await ctx.http().get(`${API}/admin/users`).query({ q: 'alice' }).set(auth(admin)).expect(200))
      .body as Paginated<AdminUserListItem>;
    expect(found.data).toHaveLength(1);
    expect(found.data[0]).toMatchObject({ email: alice.email, role: 'USER', status: 'ACTIVE', collectionCount: 2, tradeCount: 1 });

    const admins = (await ctx.http().get(`${API}/admin/users`).query({ role: 'ADMIN' }).set(auth(admin)).expect(200))
      .body as Paginated<AdminUserListItem>;
    expect(admins.data.map((u) => u.publicId)).toEqual([admin.publicId]);

    const page = (await ctx.http().get(`${API}/admin/users`).query({ limit: 2 }).set(auth(admin)).expect(200))
      .body as Paginated<AdminUserListItem>;
    expect(page.data).toHaveLength(2);
    const next = (await ctx.http().get(`${API}/admin/users`).query({ limit: 2, cursor: page.nextCursor }).set(auth(admin)).expect(200))
      .body as Paginated<AdminUserListItem>;
    expect(next.data).toHaveLength(1);
    expect(next.nextCursor).toBeNull();
  });

  it("shows a user's details, full collection and trades", async () => {
    const detail = (await ctx.http().get(`${API}/admin/users/${alice.publicId}`).set(auth(admin)).expect(200)).body as AdminUserDetail;
    expect(detail).toMatchObject({ email: alice.email, counts: { collectionItems: 2, cards: 2, trades: 1, activeTrades: 1 } });
    expect(detail.collectionValueCents).toBe(10000);
    expect(detail.lastActiveAt).not.toBeNull();

    const collection = (await ctx.http().get(`${API}/admin/users/${alice.publicId}/collection`).set(auth(admin)).expect(200))
      .body as Paginated<CollectionItemResponse>;
    expect(collection.data.map((i) => i.listingStatus).sort()).toEqual(['FOR_TRADE', 'PERSONAL']);

    const trades = (await ctx.http().get(`${API}/admin/users/${bob.publicId}/trades`).set(auth(admin)).expect(200))
      .body as Paginated<AdminTradeListItem>;
    expect(trades.data).toHaveLength(1);
    expect(trades.data[0]).toMatchObject({ id: tradeId, status: 'DRAFT', itemCount: 1 });
    expect(trades.data[0]?.initiator.publicId).toBe(alice.publicId);

    const reviews = await ctx.http().get(`${API}/admin/users/${alice.publicId}/reviews`).set(auth(admin)).expect(200);
    expect(reviews.body).toEqual({ received: [], written: [] });

    await ctx.http().get(`${API}/admin/users/nobody123456`).set(auth(admin)).expect(404);
  });

  it('shows any trade without a viewer perspective', async () => {
    const list = (await ctx.http().get(`${API}/admin/trades`).query({ status: 'DRAFT' }).set(auth(admin)).expect(200))
      .body as Paginated<AdminTradeListItem>;
    expect(list.data.map((t) => t.id)).toEqual([tradeId]);
    const none = (await ctx.http().get(`${API}/admin/trades`).query({ status: 'COMPLETED' }).set(auth(admin)).expect(200))
      .body as Paginated<AdminTradeListItem>;
    expect(none.data).toHaveLength(0);

    const detail = (await ctx.http().get(`${API}/admin/trades/${tradeId}`).set(auth(admin)).expect(200)).body as AdminTradeDetail;
    expect(detail.initiator.items).toHaveLength(1);
    expect(detail.calculation.initiatorTotalCents).toBe(5000);
    expect(detail.reviews).toEqual([]);
    expect(detail).not.toHaveProperty('myRole');
    expect(detail).not.toHaveProperty('allowedActions');

    await ctx.http().get(`${API}/admin/trades/00000000-0000-4000-8000-000000000000`).set(auth(admin)).expect(404);
  });
});
