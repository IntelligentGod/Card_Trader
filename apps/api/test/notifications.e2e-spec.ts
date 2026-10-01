import type { NotificationResponse, Paginated, UnreadCountResponse } from '@card-trader/shared';
import { API, auth, createTestApp, registerUser, resetDatabase, type TestContext, type TestUser } from './utils';

describe('Notification center (e2e)', () => {
  let ctx: TestContext;
  let tom: TestUser;
  let other: TestUser;
  let ids: string[];

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    [tom, other] = await Promise.all([registerUser(ctx, 'Tom'), registerUser(ctx, 'Other')]);
    // 8 notifications, one minute apart; n7 is the newest.
    const base = Date.now() - 60 * 60_000;
    for (let i = 0; i < 8; i++) {
      await ctx.prisma.notification.create({
        data: { userId: tom.userId, type: 'TRADE_OFFER', title: `n${i}`, body: `Offer ${i}`, data: { tradeId: `t${i}` }, createdAt: new Date(base + i * 60_000) },
      });
    }
    await ctx.prisma.notification.create({ data: { userId: other.userId, type: 'TRADE_OFFER', title: 'theirs', body: 'not Tom’s' } });
    ids = (await ctx.prisma.notification.findMany({ where: { userId: tom.userId }, orderBy: { createdAt: 'desc' }, select: { id: true } })).map((n) => n.id);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const list = (query: string) => ctx.http().get(`${API}/notifications${query}`).set(auth(tom)).expect(200).then((r) => r.body as Paginated<NotificationResponse>);
  const unread = () => ctx.http().get(`${API}/notifications/unread-count`).set(auth(tom)).expect(200).then((r) => (r.body as UnreadCountResponse).count);

  it('returns the latest 6, newest first, with a cursor for "Show all"', async () => {
    const recent = await list('?limit=6');
    expect(recent.data.map((n) => n.title)).toEqual(['n7', 'n6', 'n5', 'n4', 'n3', 'n2']);
    expect(recent.data[0]).toMatchObject({ isRead: false, readAt: null, data: { tradeId: 't7' } });
    expect(recent.nextCursor).not.toBeNull();
  });

  it('pages through the full history without gaps or repeats', async () => {
    const first = await list('?limit=3');
    const second = await list(`?limit=3&cursor=${first.nextCursor}`);
    const third = await list(`?limit=3&cursor=${second.nextCursor}`);
    expect([...first.data, ...second.data, ...third.data].map((n) => n.title)).toEqual(['n7', 'n6', 'n5', 'n4', 'n3', 'n2', 'n1', 'n0']);
    expect(third.nextCursor).toBeNull();
    expect(JSON.stringify(third)).not.toContain('theirs');
  });

  it('counts unread and marks one as read when opened', async () => {
    expect(await unread()).toBe(8);
    const res = await ctx.http().patch(`${API}/notifications/${ids[0]}/read`).set(auth(tom)).expect(200);
    expect((res.body as UnreadCountResponse).count).toBe(7);
    expect((await list('?limit=1')).data[0]).toMatchObject({ isRead: true });
    // Marking again is harmless; someone else's notification is "not found".
    await ctx.http().patch(`${API}/notifications/${ids[0]}/read`).set(auth(tom)).expect(200);
    const theirs = await ctx.prisma.notification.findFirstOrThrow({ where: { userId: other.userId } });
    await ctx.http().patch(`${API}/notifications/${theirs.id}/read`).set(auth(tom)).expect(404);
    expect((await ctx.prisma.notification.findUniqueOrThrow({ where: { id: theirs.id } })).readAt).toBeNull();
  });

  it('marks everything as read', async () => {
    const res = await ctx.http().patch(`${API}/notifications/read-all`).set(auth(tom)).expect(200);
    expect((res.body as UnreadCountResponse).count).toBe(0);
    expect(await unread()).toBe(0);
    expect((await list('?limit=50')).data.every((n) => n.isRead)).toBe(true);
    expect((await ctx.http().get(`${API}/notifications/unread-count`).set(auth(other)).expect(200)).body.count).toBe(1);
  });
});
