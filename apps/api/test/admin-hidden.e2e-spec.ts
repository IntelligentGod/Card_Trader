import type { AdminAnalytics, AdminAuditEntry, AdminOverview, AdminUserDetail, AdminUserListItem, Paginated } from '@card-trader/shared';
import { API, auth, createTestApp, registerUser, resetDatabase, type TestContext, type TestUser } from './utils';

describe('Hidden owner account (e2e)', () => {
  let ctx: TestContext;
  let owner: TestUser;
  let superAdmin: TestUser;
  let admin: TestUser;
  let user: TestUser;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    [owner, superAdmin, admin, user] = await Promise.all([
      registerUser(ctx, 'Owner'),
      registerUser(ctx, 'Second Super'),
      registerUser(ctx, 'Ann Admin'),
      registerUser(ctx, 'Uma User'),
    ]);
    await ctx.prisma.user.updateMany({ where: { id: { in: [owner.userId, superAdmin.userId] } }, data: { role: 'SUPER_ADMIN' } });
    await ctx.prisma.user.update({ where: { id: owner.userId }, data: { hiddenFromAdmins: true } });
    await ctx.prisma.user.update({ where: { id: admin.userId }, data: { role: 'ADMIN' } });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const get = (who: Pick<TestUser, 'token'>, path: string) => ctx.http().get(`${API}${path}`).set(auth(who));
  const patch = (who: Pick<TestUser, 'token'>, path: string, body: object) => ctx.http().patch(`${API}${path}`).set(auth(who)).send(body);
  const ids = async (who: TestUser, path: string) =>
    ((await get(who, path).expect(200)).body as Paginated<AdminUserListItem>).data.map((u) => u.publicId);

  it('is missing for another super admin: lists, search, admins page and counts', async () => {
    expect(await ids(superAdmin, '/admin/users')).not.toContain(owner.publicId);
    expect(await ids(superAdmin, `/admin/users?q=${encodeURIComponent(owner.email)}`)).toHaveLength(0);
    expect(await ids(superAdmin, '/admin/users?role=SUPER_ADMIN')).toEqual([superAdmin.publicId]);

    const overview = (await get(superAdmin, '/admin/overview').expect(200)).body as AdminOverview;
    expect(overview.users).toMatchObject({ total: 3, admins: 2 });
    const analytics = (await get(superAdmin, '/admin/analytics').expect(200)).body as AdminAnalytics;
    expect(analytics.users.byRole).toEqual({ USER: 1, ADMIN: 1, SUPER_ADMIN: 1 });
  });

  it('cannot be fetched or changed by another super admin (404, like an unknown account)', async () => {
    for (const path of ['', '/collection', '/trades', '/reviews', '/history']) {
      expect((await get(superAdmin, `/admin/users/${owner.publicId}${path}`).expect(404)).body.code).toBe('USER_NOT_FOUND');
    }
    await patch(superAdmin, `/admin/users/${owner.publicId}`, { displayName: 'Pwned', reason: 'test' }).expect(404);
  });

  it('is missing for normal admins too', async () => {
    expect(await ids(admin, '/admin/users')).not.toContain(owner.publicId);
    await get(admin, `/admin/users/${owner.publicId}`).expect(404);
  });

  it('still sees and edits its own account', async () => {
    expect(await ids(owner, '/admin/users')).toContain(owner.publicId);
    const me = (await get(owner, `/admin/users/${owner.publicId}`).expect(200)).body as AdminUserDetail;
    expect(me.email).toBe(owner.email);
    await patch(owner, `/admin/users/${owner.publicId}`, { displayName: 'The Owner', reason: 'rename' }).expect(200);
  });

  it('stays anonymous in the audit log for other super admins', async () => {
    await patch(owner, `/admin/users/${user.publicId}`, { displayName: 'Uma Renamed', reason: 'typo' }).expect(200);

    const asOther = ((await get(superAdmin, '/admin/audit').expect(200)).body as Paginated<AdminAuditEntry>).data;
    expect(asOther.length).toBeGreaterThanOrEqual(2);
    for (const entry of asOther) expect(entry.admin).toEqual({ publicId: null, email: null, displayName: 'Administrator' });
    expect(asOther.some((e) => e.target?.publicId === owner.publicId)).toBe(false);
    expect(JSON.stringify(asOther)).not.toContain(owner.email);

    const asOwner = ((await get(owner, '/admin/audit').expect(200)).body as Paginated<AdminAuditEntry>).data;
    expect(asOwner.every((e) => e.admin.email === owner.email)).toBe(true);
  });
});
