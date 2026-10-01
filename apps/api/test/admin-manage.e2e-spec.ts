import type { AdminAnalytics, AdminAuditEntry, AdminCardDetail, AdminCardListItem, AdminUserDetail, Paginated } from '@card-trader/shared';
import { API, auth, createCard, createTestApp, registerUser, resetDatabase, type TestContext, type TestUser } from './utils';

describe('Admin changes, catalog and analytics (e2e)', () => {
  let ctx: TestContext;
  let admin: TestUser;
  let otherAdmin: TestUser;
  let alice: TestUser;
  let bob: TestUser;
  let seededCard: string;
  let submittedCard: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    [admin, otherAdmin, alice, bob] = await Promise.all([
      registerUser(ctx, 'Admin'),
      registerUser(ctx, 'Other Admin'),
      registerUser(ctx, 'Alice'),
      registerUser(ctx, 'Bob'),
    ]);
    await ctx.prisma.user.updateMany({ where: { id: { in: [admin.userId, otherAdmin.userId] } }, data: { role: 'ADMIN' } });

    seededCard = await createCard(ctx.prisma, { name: 'Pikachu', values: { RAW: 4000, 'GRADED:PSA:10': 30000 } });
    const set = await ctx.prisma.cardSet.findFirstOrThrow({ where: { code: 'TEST' } });
    const submitted = await ctx
      .http()
      .post(`${API}/cards`)
      .set(auth(alice))
      .send({ setId: set.id, name: 'Mystery Promo', cardNumber: 'P-99' })
      .expect(201);
    submittedCard = submitted.body.id;
    await ctx.http().post(`${API}/collection`).set(auth(alice)).send({ cardId: seededCard, condition: 'RAW', quantity: 2 }).expect(201);
    await ctx
      .http()
      .post(`${API}/collection`)
      .set(auth(bob))
      .send({ cardId: seededCard, condition: 'GRADED', gradingCompany: 'PSA', grade: 10, listingStatus: 'FOR_SALE' })
      .expect(201);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const patchUser = (who: TestUser, target: TestUser, body: Record<string, unknown>) =>
    ctx.http().patch(`${API}/admin/users/${target.publicId}`).set(auth(who)).send(body);

  describe('editing users', () => {
    it('updates profile fields and email, and records who changed what', async () => {
      const res = await patchUser(admin, alice, {
        displayName: 'Alice Cards',
        bio: 'Edited by support',
        email: 'ALICE.NEW@Example.com',
        reason: 'Requested by the user',
      }).expect(200);
      const detail = res.body as AdminUserDetail;
      expect(detail).toMatchObject({ displayName: 'Alice Cards', bio: 'Edited by support', email: 'alice.new@example.com' });

      const history = (await ctx.http().get(`${API}/admin/users/${alice.publicId}/history`).set(auth(admin)).expect(200))
        .body as AdminAuditEntry[];
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({ action: 'USER_UPDATED', reason: 'Requested by the user', admin: { publicId: admin.publicId } });
      expect(history[0]?.changes.email).toEqual({ from: alice.email, to: 'alice.new@example.com' });
      expect(Object.keys(history[0]?.changes ?? {}).sort()).toEqual(['bio', 'displayName', 'email']);
    });

    it('records nothing when nothing changes', async () => {
      await patchUser(admin, alice, { displayName: 'Alice Cards' }).expect(200);
      const history = await ctx.http().get(`${API}/admin/users/${alice.publicId}/history`).set(auth(admin)).expect(200);
      expect(history.body).toHaveLength(1);
    });

    it('rejects an email or username another account uses, and invalid values', async () => {
      const taken = await patchUser(admin, alice, { email: bob.email }).expect(409);
      expect(taken.body.code).toBe('EMAIL_TAKEN');
      const bobProfile = await ctx.prisma.profile.findUniqueOrThrow({ where: { userId: bob.userId } });
      expect((await patchUser(admin, alice, { username: bobProfile.username }).expect(409)).body.code).toBe('USERNAME_TAKEN');
      await patchUser(admin, alice, { username: 'No Spaces!' }).expect(400);
      await patchUser(admin, alice, { role: 'ADMIN' }).expect(400);
    });

    it('is admin only', async () => {
      expect((await patchUser(bob, alice, { displayName: 'Hacked' }).expect(403)).body.code).toBe('ADMIN_ONLY');
    });
  });

  // Blocking, password resets and role changes: see admin-rbac.e2e-spec.ts.

  describe('vendor profiles', () => {
    it('edits an existing vendor profile and 404s when there is none', async () => {
      expect((await ctx.http().patch(`${API}/admin/users/${bob.publicId}/vendor`).set(auth(admin)).send({ businessName: 'X Cards' }).expect(404)).body.code).toBe(
        'VENDOR_NOT_FOUND',
      );
      await ctx.http().put(`${API}/users/me/vendor`).set(auth(bob)).send({ isActive: true, businessName: 'Bob Cards' }).expect(200);
      const res = await ctx
        .http()
        .patch(`${API}/admin/users/${bob.publicId}/vendor`)
        .set(auth(admin))
        .send({ businessName: 'Bob’s Card Shop', isActive: false, reason: 'Trademark complaint' })
        .expect(200);
      expect((res.body as AdminUserDetail).vendor).toMatchObject({ businessName: 'Bob’s Card Shop', isActive: false });
    });
  });

  describe('card catalog', () => {
    it('lists every card with status, owners and value, unverified first', async () => {
      const all = (await ctx.http().get(`${API}/admin/cards`).set(auth(admin)).expect(200)).body as Paginated<AdminCardListItem>;
      expect(all.data.map((c) => c.id)).toEqual([submittedCard, seededCard]);
      expect(all.data[0]).toMatchObject({ isVerified: false, source: 'USER_SUBMITTED', submittedBy: { publicId: alice.publicId } });
      expect(all.data[1]).toMatchObject({ isVerified: true, collectionItemCount: 2, topValueCents: 30000 });

      const unverified = (await ctx.http().get(`${API}/admin/cards`).query({ verified: 'false' }).set(auth(admin)).expect(200))
        .body as Paginated<AdminCardListItem>;
      expect(unverified.data.map((c) => c.id)).toEqual([submittedCard]);
      const search = (await ctx.http().get(`${API}/admin/cards`).query({ q: 'mystery' }).set(auth(admin)).expect(200))
        .body as Paginated<AdminCardListItem>;
      expect(search.data.map((c) => c.id)).toEqual([submittedCard]);
      await ctx.http().get(`${API}/admin/cards`).query({ verified: 'maybe' }).set(auth(admin)).expect(400);
    });

    it('shows card detail with market values, owners and copies', async () => {
      const detail = (await ctx.http().get(`${API}/admin/cards/${seededCard}`).set(auth(admin)).expect(200)).body as AdminCardDetail;
      expect(detail).toMatchObject({ ownerCount: 2, copies: 3, tradeItemCount: 0 });
      expect(detail.marketValues.map((v) => v.valueCents).sort()).toEqual([30000, 4000]);
    });

    it('verifies a submitted card so everyone can use it, and records it', async () => {
      await ctx.http().get(`${API}/cards/${submittedCard}`).set(auth(bob)).expect(404);
      const res = await ctx.http().patch(`${API}/admin/cards/${submittedCard}`).set(auth(admin)).send({ isVerified: true, reason: 'Checked' }).expect(200);
      const detail = res.body as AdminCardDetail;
      expect(detail.isVerified).toBe(true);
      expect(detail.history[0]).toMatchObject({ action: 'CARD_VERIFIED', reason: 'Checked' });
      await ctx.http().get(`${API}/cards/${submittedCard}`).set(auth(bob)).expect(200);
    });

    it('edits card details and refuses a duplicate number in the same set', async () => {
      const edited = await ctx.http().patch(`${API}/admin/cards/${submittedCard}`).set(auth(admin)).send({ name: 'Mystery Promo (2024)', rarity: 'Promo' }).expect(200);
      expect((edited.body as AdminCardDetail).history[0]).toMatchObject({ action: 'CARD_UPDATED' });
      const seeded = await ctx.prisma.card.findUniqueOrThrow({ where: { id: seededCard } });
      const dup = await ctx
        .http()
        .patch(`${API}/admin/cards/${submittedCard}`)
        .set(auth(admin))
        .send({ cardNumber: seeded.cardNumber, variant: seeded.variant })
        .expect(409);
      expect(dup.body.code).toBe('CARD_EXISTS');
      await ctx.http().patch(`${API}/admin/cards/${submittedCard}`).set(auth(admin)).send({ imageUrl: 'javascript:alert(1)' }).expect(400);
    });
  });

  it('builds analytics for the whole app', async () => {
    const a = (await ctx.http().get(`${API}/admin/analytics`).set(auth(admin)).expect(200)).body as AdminAnalytics;
    expect(a.users.byRole).toEqual({ USER: 2, ADMIN: 2 });
    expect(a.users.byStatus).toEqual({ ACTIVE: 4, BLOCKED: 0, DISABLED: 0 });
    expect(a.users.signupsByMonth).toHaveLength(12);
    expect(a.users.signupsByMonth.at(-1)?.count).toBe(4);
    expect(a.collection).toMatchObject({ rawItems: 1, gradedItems: 1, byGrader: { PSA: 1, BGS: 0, CGC: 0, OTHER: 0 } });
    expect(a.collection.byListingStatus).toMatchObject({ PERSONAL: 1, FOR_SALE: 1 });
    expect(a.collection.byCategory.find((c) => c.category === 'POKEMON')).toMatchObject({ items: 2, cards: 3, valueCents: 38000 });
    expect(a.catalog).toMatchObject({ total: 2, verified: 2, unverified: 0, bySource: { SEED: 1, IMPORT: 0, USER_SUBMITTED: 1 } });
    expect(a.trades.completedByMonth).toHaveLength(12);
    expect(a.trades.averageCompletedValueCents).toBeNull();
    expect(a.topCards[0]).toMatchObject({ cardId: seededCard, copies: 3, valueCents: 38000 });
  });
});
