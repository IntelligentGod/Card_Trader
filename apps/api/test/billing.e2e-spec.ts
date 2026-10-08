import type { AdminAuditEntry, AdminUserDetail, BillingStatusResponse, MeResponse } from '@card-trader/shared';
import { API, auth, createTestApp, registerUser, resetDatabase, type TestContext, type TestUser } from './utils';

const WEBHOOK = `${API}/billing/webhooks/revenuecat`;
const SECRET = process.env.REVENUECAT_WEBHOOK_SECRET!;

describe('One-time purchase (e2e)', () => {
  let ctx: TestContext;
  let free: TestUser;
  let paid: TestUser;
  let admin: TestUser;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    [free, paid, admin] = await Promise.all([registerUser(ctx, 'Free Fay', { paid: false }), registerUser(ctx, 'Paid Pat'), registerUser(ctx, 'Ann Admin', { paid: false })]);
    await ctx.prisma.user.update({ where: { id: admin.userId }, data: { role: 'ADMIN' } });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const get = (who: TestUser, path: string) => ctx.http().get(`${API}${path}`).set(auth(who));
  const post = (who: TestUser, path: string, body: object = {}) => ctx.http().post(`${API}${path}`).set(auth(who)).send(body);
  const me = async (who: TestUser) => (await get(who, '/users/me').expect(200)).body as MeResponse;
  const webhook = (event: object, secret = SECRET) => ctx.http().post(WEBHOOK).set('Authorization', secret).send({ api_version: '1.0', event });
  const purchase = (publicId: string, extra: object = {}) => ({
    type: 'INITIAL_PURCHASE',
    app_user_id: publicId,
    original_app_user_id: publicId,
    entitlement_ids: ['full_access'],
    product_id: 'card_trader_full_access',
    store: 'PLAY_STORE',
    ...extra,
  });

  describe('before paying', () => {
    it('can see its own profile and billing status, but nothing else (402 PAYMENT_REQUIRED)', async () => {
      expect((await me(free)).hasFullAccess).toBe(false);
      const status = (await get(free, '/billing/status').expect(200)).body as BillingStatusResponse;
      expect(status).toMatchObject({ hasFullAccess: false, paywallEnabled: true, storeConfigured: false, entitlementId: 'full_access', paidAt: null });

      for (const path of ['/collection', '/portfolio/summary', '/trades?scope=active', '/events?scope=upcoming', '/cards', '/notifications/unread-count']) {
        expect((await get(free, path).expect(402)).body.code).toBe('PAYMENT_REQUIRED');
      }
      expect((await post(free, '/collection', { cardId: '00000000-0000-0000-0000-000000000000', quantity: 1 }).expect(402)).body.code).toBe('PAYMENT_REQUIRED');
    });

    it('can still manage the account: change password, 2FA setup, sign out', async () => {
      await post(free, '/auth/2fa/setup').expect(200);
      const changed = await post(free, '/auth/change-password', { currentPassword: 'Tr4ding-Cards-Rock', newPassword: 'Another-Str0ng-Pass' }).expect(200);
      free = { ...free, token: changed.body.tokens.accessToken, refreshToken: changed.body.tokens.refreshToken };
      await post(free, '/auth/logout', { refreshToken: free.refreshToken }).expect(204);
      const login = await ctx.http().post(`${API}/auth/login`).send({ email: free.email, password: 'Another-Str0ng-Pass' }).expect(200);
      free = { ...free, token: login.body.tokens.accessToken, refreshToken: login.body.tokens.refreshToken };
    });

    it('cannot sync a purchase while the store is not configured', async () => {
      expect((await post(free, '/billing/sync').expect(503)).body.code).toBe('BILLING_NOT_CONFIGURED');
    });
  });

  it('paid accounts and admins have full access', async () => {
    expect((await me(paid)).hasFullAccess).toBe(true);
    await get(paid, '/collection').expect(200);
    expect((await me(admin)).hasFullAccess).toBe(true);
    await get(admin, '/collection').expect(200);
  });

  describe('RevenueCat webhook', () => {
    it('rejects a wrong or missing secret', async () => {
      expect((await webhook(purchase(free.publicId), 'nope').expect(401)).body.code).toBe('WEBHOOK_UNAUTHORIZED');
      await ctx.http().post(WEBHOOK).send({ event: purchase(free.publicId) }).expect(401);
      expect((await me(free)).hasFullAccess).toBe(false);
    });

    it('ignores events for unknown accounts and events without the entitlement', async () => {
      expect((await webhook(purchase('nobody-here-123')).expect(200)).body).toEqual({ handled: false });
      await webhook(purchase(free.publicId, { entitlement_ids: ['something_else'] })).expect(200);
      await webhook({ type: 'TRANSFER', app_user_id: free.publicId, entitlement_ids: [] }).expect(200);
      expect((await me(free)).hasFullAccess).toBe(false);
    });

    it('unlocks the account on a purchase, then locks it again after a refund', async () => {
      expect((await webhook(purchase(free.publicId)).expect(200)).body).toEqual({ handled: true });
      expect((await me(free)).hasFullAccess).toBe(true);
      await get(free, '/collection').expect(200);
      const row = await ctx.prisma.user.findUniqueOrThrow({ where: { id: free.userId } });
      expect(row.paidVia).toBe('PLAY_STORE');
      expect(row.paidAt).not.toBeNull();
      // A second purchase event keeps the original purchase date.
      await webhook(purchase(free.publicId, { store: 'APP_STORE' })).expect(200);
      expect((await ctx.prisma.user.findUniqueOrThrow({ where: { id: free.userId } })).paidAt).toEqual(row.paidAt);

      await webhook(purchase(free.publicId, { type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT' })).expect(200);
      await webhook(purchase(free.publicId, { type: 'EXPIRATION' })).expect(200);
      expect((await me(free)).hasFullAccess).toBe(false);
      await get(free, '/collection').expect(402);
    });

    it('finds the account through an alias too', async () => {
      await webhook(purchase('anonymous-device-id', { aliases: ['anonymous-device-id', free.publicId] })).expect(200);
      expect((await me(free)).hasFullAccess).toBe(true);
      await webhook(purchase(free.publicId, { type: 'EXPIRATION' })).expect(200);
      expect((await me(free)).hasFullAccess).toBe(false);
    });
  });

  describe('admin grants', () => {
    it('an admin grants and revokes access, with an audit trail and a notification', async () => {
      const granted = (await post(admin, `/admin/users/${free.publicId}/grant-access`, { reason: 'Beta tester' }).expect(200)).body as AdminUserDetail;
      expect(granted).toMatchObject({ hasFullAccess: true, paidVia: 'ADMIN' });
      expect(granted.paidAt).not.toBeNull();
      expect((await me(free)).hasFullAccess).toBe(true);
      await get(free, '/collection').expect(200);
      expect((await post(admin, `/admin/users/${free.publicId}/grant-access`).expect(409)).body.code).toBe('ALREADY_HAS_ACCESS');

      const history = (await get(admin, `/admin/users/${free.publicId}/history`).expect(200)).body as AdminAuditEntry[];
      expect(history[0]).toMatchObject({ action: 'ACCESS_GRANTED', reason: 'Beta tester', changes: { access: { from: false, to: true } } });
      const notifications = (await get(free, '/notifications?limit=5').expect(200)).body as { data: { title: string }[] };
      expect(notifications.data.some((n) => n.title === 'Card Trader unlocked')).toBe(true);

      // A store refund never takes an admin grant away.
      await webhook(purchase(free.publicId, { type: 'EXPIRATION' })).expect(200);
      expect((await me(free)).hasFullAccess).toBe(true);

      const revoked = (await post(admin, `/admin/users/${free.publicId}/revoke-access`, { reason: 'Beta over' }).expect(200)).body as AdminUserDetail;
      expect(revoked).toMatchObject({ hasFullAccess: false, paidAt: null, paidVia: null });
      await get(free, '/collection').expect(402);
      expect((await post(admin, `/admin/users/${free.publicId}/revoke-access`).expect(409)).body.code).toBe('NO_ACCESS_TO_REVOKE');
    });

    it('follows the same permission rules as blocking (admins cannot touch other admins)', async () => {
      const other = await registerUser(ctx, 'Otto Admin', { paid: false });
      await ctx.prisma.user.update({ where: { id: other.userId }, data: { role: 'ADMIN' } });
      expect((await post(admin, `/admin/users/${other.publicId}/grant-access`).expect(403)).body.code).toBe('ADMIN_ACTION_NOT_ALLOWED');
      expect((await post(free, `/admin/users/${paid.publicId}/grant-access`).expect(403)).body.code).toBe('ADMIN_ONLY');
    });

    it('shows the unlock in the admin user list and detail', async () => {
      const detail = (await get(admin, `/admin/users/${paid.publicId}`).expect(200)).body as AdminUserDetail;
      expect(detail).toMatchObject({ hasFullAccess: true, paidVia: 'SEED' });
      const list = (await get(admin, `/admin/users?q=${encodeURIComponent(free.email)}`).expect(200)).body as { data: { hasFullAccess: boolean }[] };
      expect(list.data[0]?.hasFullAccess).toBe(false);
    });
  });
});
