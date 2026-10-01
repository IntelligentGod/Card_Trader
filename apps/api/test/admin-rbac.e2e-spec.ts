import type {
  AdminAnalytics,
  AdminAuditEntry,
  AdminOverview,
  AdminUserDetail,
  AdminUserListItem,
  AuthResponse,
  MeResponse,
  NotificationResponse,
  Paginated,
} from '@card-trader/shared';
import { MailService } from '../src/modules/mail/mail.service';
import { API, auth, createTestApp, registerUser, resetDatabase, type TestContext, type TestUser } from './utils';

const PASSWORD = 'Tr4ding-Cards-Rock';

describe('Admin roles: SUPER_ADMIN, ADMIN, USER (e2e)', () => {
  let ctx: TestContext;
  let superAdmin: TestUser;
  let admin: TestUser;
  let otherAdmin: TestUser;
  let user: TestUser;
  let victim: TestUser;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    [superAdmin, admin, otherAdmin, user, victim] = await Promise.all([
      registerUser(ctx, 'Root'),
      registerUser(ctx, 'Ann Admin'),
      registerUser(ctx, 'Otto Admin'),
      registerUser(ctx, 'Uma User'),
      registerUser(ctx, 'Vic User'),
    ]);
    await ctx.prisma.user.update({ where: { id: superAdmin.userId }, data: { role: 'SUPER_ADMIN' } });
    await ctx.prisma.user.updateMany({ where: { id: { in: [admin.userId, otherAdmin.userId] } }, data: { role: 'ADMIN' } });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const get = (who: Pick<TestUser, 'token'>, path: string) => ctx.http().get(`${API}${path}`).set(auth(who));
  const post = (who: Pick<TestUser, 'token'>, path: string, body: object = {}) => ctx.http().post(`${API}${path}`).set(auth(who)).send(body);
  const patch = (who: Pick<TestUser, 'token'>, path: string, body: object) => ctx.http().patch(`${API}${path}`).set(auth(who)).send(body);
  const login = (email: string, password = PASSWORD) => ctx.http().post(`${API}/auth/login`).send({ email, password });
  const history = async (publicId: string, viewer: TestUser = superAdmin) =>
    (await get(viewer, `/admin/users/${publicId}/history`).expect(200)).body as AdminAuditEntry[];

  describe('USER', () => {
    it('cannot reach any admin endpoint', async () => {
      for (const path of ['/admin/overview', '/admin/users', `/admin/users/${victim.publicId}`, '/admin/audit', '/admin/cards']) {
        expect((await get(user, path).expect(403)).body.code).toBe('ADMIN_ONLY');
      }
      expect((await post(user, `/admin/users/${victim.publicId}/block`).expect(403)).body.code).toBe('ADMIN_ONLY');
    });
  });

  describe('the super admin is invisible to normal admins', () => {
    it('is missing from lists, search, role filters and counts', async () => {
      const list = (await get(admin, '/admin/users').expect(200)).body as Paginated<AdminUserListItem>;
      expect(list.data.map((u) => u.publicId)).not.toContain(superAdmin.publicId);
      expect(list.data).toHaveLength(4);
      expect(((await get(admin, `/admin/users?q=${encodeURIComponent(superAdmin.email)}`).expect(200)).body as Paginated<AdminUserListItem>).data).toHaveLength(0);
      expect(((await get(admin, '/admin/users?role=SUPER_ADMIN').expect(200)).body as Paginated<AdminUserListItem>).data).toHaveLength(0);

      const overview = (await get(admin, '/admin/overview').expect(200)).body as AdminOverview;
      expect(overview.users).toMatchObject({ total: 4, admins: 2 });
      const analytics = (await get(admin, '/admin/analytics').expect(200)).body as AdminAnalytics;
      expect(analytics.users.byRole).toEqual({ USER: 2, ADMIN: 2 });
      expect(JSON.stringify(analytics)).not.toContain('SUPER_ADMIN');
    });

    it('cannot be fetched, edited, blocked, reset or demoted by an admin', async () => {
      const id = superAdmin.publicId;
      for (const path of ['', '/collection', '/trades', '/reviews', '/history']) {
        expect((await get(admin, `/admin/users/${id}${path}`).expect(404)).body.code).toBe('USER_NOT_FOUND');
      }
      await patch(admin, `/admin/users/${id}`, { displayName: 'Pwned' }).expect(404);
      await post(admin, `/admin/users/${id}/block`, { reason: 'x' }).expect(404);
      await post(admin, `/admin/users/${id}/reset-password`, { newPassword: 'Another-Pass-77' }).expect(404);
      await patch(admin, `/admin/users/${id}/role`, { role: 'USER' }).expect(403);
      const root = await ctx.prisma.user.findUniqueOrThrow({ where: { id: superAdmin.userId }, include: { profile: true } });
      expect(root).toMatchObject({ role: 'SUPER_ADMIN', status: 'ACTIVE' });
      expect(root.profile?.displayName).toBe('Root');
    });

    it('is visible to the super admin, who sees and manages every admin', async () => {
      const list = (await get(superAdmin, '/admin/users').expect(200)).body as Paginated<AdminUserListItem>;
      expect(list.data).toHaveLength(5);
      const admins = (await get(superAdmin, '/admin/users?role=ADMIN').expect(200)).body as Paginated<AdminUserListItem>;
      expect(admins.data.map((u) => u.publicId).sort()).toEqual([admin.publicId, otherAdmin.publicId].sort());
      const otto = (await get(superAdmin, `/admin/users/${otherAdmin.publicId}`).expect(200)).body as AdminUserDetail;
      expect(otto.permissions).toEqual({ editProfile: true, changeRole: true, resetPassword: true, block: true });
    });
  });

  describe('role rules', () => {
    it('admins can view other admins but not manage them', async () => {
      const otto = (await get(admin, `/admin/users/${otherAdmin.publicId}`).expect(200)).body as AdminUserDetail;
      expect(otto.permissions).toEqual({ editProfile: false, changeRole: false, resetPassword: false, block: false });
      expect((await post(admin, `/admin/users/${otherAdmin.publicId}/block`).expect(403)).body.code).toBe('ADMIN_ACTION_NOT_ALLOWED');
      await post(admin, `/admin/users/${otherAdmin.publicId}/reset-password`, { newPassword: 'Another-Pass-77' }).expect(403);
      await patch(admin, `/admin/users/${otherAdmin.publicId}`, { displayName: 'Changed' }).expect(403);
    });

    it('only the super admin changes roles, and nobody can grant SUPER_ADMIN', async () => {
      expect((await patch(admin, `/admin/users/${user.publicId}/role`, { role: 'ADMIN' }).expect(403)).body.code).toBe('SUPER_ADMIN_ONLY');
      await patch(superAdmin, `/admin/users/${user.publicId}/role`, { role: 'SUPER_ADMIN' }).expect(400);
      await patch(admin, `/admin/users/${user.publicId}`, { role: 'SUPER_ADMIN' }).expect(400);
      expect((await post(admin, '/admin/admins', { email: 'new@example.com', username: 'new_admin', displayName: 'New', temporaryPassword: 'Temp-Pass-9999' }).expect(403)).body.code).toBe(
        'SUPER_ADMIN_ONLY',
      );
    });

    it('the super admin promotes and demotes, effective on the next request', async () => {
      await patch(superAdmin, `/admin/users/${user.publicId}/role`, { role: 'ADMIN', reason: 'Helping at shows' }).expect(200);
      await get(user, '/admin/overview').expect(200);
      await patch(superAdmin, `/admin/users/${user.publicId}/role`, { role: 'USER' }).expect(200);
      await get(user, '/admin/overview').expect(403);
      const entries = await history(user.publicId);
      expect(entries.map((e) => e.action)).toEqual(['ADMIN_REMOVED', 'ADMIN_ROLE_CHANGED']);
      expect(entries[1]).toMatchObject({ reason: 'Helping at shows', changes: { role: { from: 'USER', to: 'ADMIN' } } });
    });

    it('the super admin can’t change its own role or block itself', async () => {
      await patch(superAdmin, `/admin/users/${superAdmin.publicId}/role`, { role: 'USER' }).expect(403);
      await post(superAdmin, `/admin/users/${superAdmin.publicId}/block`).expect(403);
    });
  });

  describe('blocking', () => {
    it('an admin blocks a user: locked out at once, clear login message, then unblocked', async () => {
      await post(admin, `/admin/users/${victim.publicId}/block`, { reason: 'Fake listings' }).expect(200);
      const now = await get(victim, '/collection').expect(403);
      expect(now.body).toMatchObject({ code: 'ACCOUNT_BLOCKED', message: 'Your account has been blocked. Please contact support.' });
      await ctx.http().post(`${API}/auth/refresh`).send({ refreshToken: victim.refreshToken }).expect(401);
      const denied = await login(victim.email).expect(403);
      expect(denied.body.message).toBe('Your account has been blocked. Please contact support.');
      // A wrong password still says only "invalid", so blocking doesn't confirm the account exists.
      expect((await login(victim.email, 'wrong-password-1').expect(401)).body.code).toBe('INVALID_CREDENTIALS');

      const detail = (await get(admin, `/admin/users/${victim.publicId}`).expect(200)).body as AdminUserDetail;
      expect(detail).toMatchObject({ status: 'BLOCKED', blockReason: 'Fake listings' });
      await post(admin, `/admin/users/${victim.publicId}/block`).expect(409);

      await post(admin, `/admin/users/${victim.publicId}/unblock`).expect(200);
      const back = (await login(victim.email).expect(200)).body as AuthResponse;
      victim = { ...victim, token: back.tokens.accessToken, refreshToken: back.tokens.refreshToken };
      expect((await history(victim.publicId)).map((e) => e.action).slice(0, 2)).toEqual(['USER_ENABLED', 'USER_DISABLED']);
    });

    it('the super admin can disable and re-enable an admin', async () => {
      await post(superAdmin, `/admin/users/${otherAdmin.publicId}/block`).expect(200);
      expect((await get(otherAdmin, '/admin/overview').expect(403)).body.code).toBe('ACCOUNT_BLOCKED');
      await post(superAdmin, `/admin/users/${otherAdmin.publicId}/unblock`).expect(200);
      expect((await history(otherAdmin.publicId)).map((e) => e.action).slice(0, 2)).toEqual(['ADMIN_ENABLED', 'ADMIN_DISABLED']);
    });
  });

  describe('password reset', () => {
    it('ends every session, never exposes the password, and forces a change', async () => {
      await new Promise((r) => setTimeout(r, 1100)); // step past tokens issued this second
      const res = await post(admin, `/admin/users/${victim.publicId}/reset-password`, { newPassword: 'Temporary-Pass-55', reason: 'Locked out' }).expect(200);
      expect(JSON.stringify(res.body)).not.toContain('Temporary-Pass-55');
      const stored = await ctx.prisma.user.findUniqueOrThrow({ where: { id: victim.userId } });
      expect(stored.passwordHash).not.toContain('Temporary-Pass-55');
      expect(stored.passwordHash?.startsWith('$argon2id$')).toBe(true);
      const audit = await ctx.prisma.adminAuditLog.findFirstOrThrow({ where: { action: 'USER_PASSWORD_RESET', targetId: victim.userId } });
      expect(JSON.stringify(audit)).not.toContain('Temporary-Pass-55');

      await get(victim, '/users/me').expect(401);
      await ctx.http().post(`${API}/auth/refresh`).send({ refreshToken: victim.refreshToken }).expect(401);
      await login(victim.email).expect(401);

      const signedIn = (await login(victim.email, 'Temporary-Pass-55').expect(200)).body as AuthResponse;
      const temp = { token: signedIn.tokens.accessToken };
      expect(signedIn.user.mustChangePassword).toBe(true);
      expect((await get(temp, '/collection').expect(403)).body.code).toBe('PASSWORD_CHANGE_REQUIRED');
      await get(temp, '/users/me').expect(200);
      const changed = (await post(temp, '/auth/change-password', { newPassword: 'My-Own-Pass-2026' }).expect(200)).body as AuthResponse;
      expect(changed.user.mustChangePassword).toBe(false);
      await get({ token: changed.tokens.accessToken }, '/collection').expect(200);
    });

    it('admins can’t reset the super admin’s or another admin’s password', async () => {
      await post(admin, `/admin/users/${superAdmin.publicId}/reset-password`, { newPassword: 'Another-Pass-77' }).expect(404);
      await post(admin, `/admin/users/${otherAdmin.publicId}/reset-password`, { newPassword: 'Another-Pass-77' }).expect(403);
      await login(superAdmin.email).expect(200);
    });
  });

  describe('creating admins', () => {
    it('the super admin creates an admin who must change the password and verify the email', async () => {
      const created = (
        await post(superAdmin, '/admin/admins', { email: 'Nina@Example.com', username: 'nina_admin', displayName: 'Nina', temporaryPassword: 'Welcome-Board-2026' }).expect(201)
      ).body as AdminUserDetail;
      expect(created).toMatchObject({ role: 'ADMIN', email: 'nina@example.com', mustChangePassword: true, emailVerified: false });
      expect(ctx.app.get(MailService).outbox.some((m) => m.to === 'nina@example.com')).toBe(true);
      const nina = (await login('nina@example.com', 'Welcome-Board-2026').expect(200)).body as AuthResponse;
      expect((await get({ token: nina.tokens.accessToken }, '/admin/overview').expect(403)).body.code).toBe('PASSWORD_CHANGE_REQUIRED');
      expect((await history(created.publicId))[0]).toMatchObject({ action: 'ADMIN_CREATED' });
    });
  });

  describe('audit log', () => {
    it('is only available in full to the super admin, with IP addresses', async () => {
      expect((await get(admin, '/admin/audit').expect(403)).body.code).toBe('SUPER_ADMIN_ONLY');
      const log = (await get(superAdmin, '/admin/audit?limit=50').expect(200)).body as Paginated<AdminAuditEntry>;
      const actions = log.data.map((e) => e.action);
      for (const action of ['USER_PASSWORD_RESET', 'USER_DISABLED', 'USER_ENABLED', 'ADMIN_ROLE_CHANGED', 'ADMIN_REMOVED', 'ADMIN_DISABLED', 'ADMIN_CREATED']) {
        expect(actions).toContain(action);
      }
      expect(log.data.every((e) => typeof e.ipAddress === 'string' && e.ipAddress.length > 0)).toBe(true);
      const resets = (await get(superAdmin, '/admin/audit?action=USER_PASSWORD_RESET').expect(200)).body as Paginated<AdminAuditEntry>;
      expect(resets.data).toHaveLength(1);
      expect(resets.data[0]?.target?.publicId).toBe(victim.publicId);
    });

    it('hides the super admin and IPs from a normal admin reading a user’s history', async () => {
      const entries = await history(user.publicId, admin);
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(entry.admin).toEqual({ publicId: null, email: null, displayName: 'Administrator' });
        expect(entry.ipAddress).toBeNull();
      }
      expect(JSON.stringify(entries)).not.toContain(superAdmin.email);
    });
  });

  describe('announcements', () => {
    it('the super admin notifies every active user; admins can’t', async () => {
      await post(admin, '/admin/notifications/broadcast', { title: 'Hi', message: 'Hello there' }).expect(403);
      const sent = await post(superAdmin, '/admin/notifications/broadcast', { title: 'Austin show this weekend', message: 'See you at table row C!' }).expect(200);
      expect(sent.body.recipients).toBeGreaterThanOrEqual(5);
      const inbox = (await get(user, '/notifications?limit=6').expect(200)).body as Paginated<NotificationResponse>;
      expect(inbox.data[0]).toMatchObject({ type: 'ANNOUNCEMENT', title: 'Austin show this weekend', isRead: false });
    });
  });

  it('reports roles to the app', async () => {
    expect(((await get(superAdmin, '/users/me').expect(200)).body as MeResponse).role).toBe('SUPER_ADMIN');
  });
});
