import type { TradeResponse } from '@card-trader/shared';
import { API, auth, createCard, createTestApp, registerUser, resetDatabase, type TestContext, type TestUser } from './utils';

describe('Trades & reviews (e2e)', () => {
  let ctx: TestContext;
  let alice: TestUser;
  let bob: TestUser;
  let mallory: TestUser;
  let pikachuItem: string;
  let sportsItem: string;
  let onePieceItem: string;
  let bobPokemonItem: string;
  let bobPrivateItem: string;

  const addItem = (user: TestUser, cardId: string, body: Record<string, unknown>) =>
    ctx
      .http()
      .post(`${API}/collection`)
      .set(auth(user))
      .send({ cardId, ...body })
      .expect(201)
      .then((r) => r.body.id as string);

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    [alice, bob, mallory] = await Promise.all([
      registerUser(ctx, 'Alice'),
      registerUser(ctx, 'Bob'),
      registerUser(ctx, 'Mallory'),
    ]);

    // Spec example: my offer $220 + $80 = $300; their offer $250 + $30 = $280.
    const pikachu = await createCard(ctx.prisma, { name: 'Pikachu', values: { 'GRADED:PSA:10': 22000 } });
    const sports = await createCard(ctx.prisma, { name: 'Rookie', category: 'SPORTS', values: { RAW: 8000 } });
    const luffy = await createCard(ctx.prisma, { name: 'Luffy', category: 'ONE_PIECE', values: { 'RAW:NEAR_MINT': 25000 } });
    const eevee = await createCard(ctx.prisma, { name: 'Eevee', values: { RAW: 3000 } });

    pikachuItem = await addItem(alice, pikachu, { condition: 'GRADED', gradingCompany: 'PSA', grade: 10 });
    sportsItem = await addItem(alice, sports, { condition: 'RAW' });
    onePieceItem = await addItem(bob, luffy, { condition: 'NEAR_MINT', listingStatus: 'FOR_TRADE' });
    bobPokemonItem = await addItem(bob, eevee, { condition: 'RAW', listingStatus: 'FOR_TRADE' });
    bobPrivateItem = await addItem(bob, eevee, { condition: 'RAW', quantity: 2, listingStatus: 'PERSONAL' });
  });
  afterAll(async () => ctx.app.close());

  let trade: TradeResponse;

  it('creates a trade from a scanned public id and reuses the open draft', async () => {
    const res = await ctx.http().post(`${API}/trades`).set(auth(alice)).send({ counterpartyPublicId: bob.publicId }).expect(201);
    trade = res.body;
    expect(trade).toMatchObject({ status: 'DRAFT', myRole: 'INITIATOR', version: 1 });
    expect(trade.counterparty.user.publicId).toBe(bob.publicId);

    const again = await ctx.http().post(`${API}/trades`).set(auth(alice)).send({ counterpartyPublicId: bob.publicId }).expect(201);
    expect(again.body.id).toBe(trade.id);

    await ctx
      .http()
      .post(`${API}/trades`)
      .set(auth(alice))
      .send({ counterpartyPublicId: alice.publicId })
      .expect(400)
      .expect((r) => expect(r.body.code).toBe('CANNOT_TRADE_WITH_SELF'));
  });

  it('only allows own cards or the other side’s cards listed for trade/sale', async () => {
    await ctx
      .http()
      .post(`${API}/trades/${trade.id}/items`)
      .set(auth(alice))
      .send({ collectionItemId: bobPrivateItem })
      .expect(404);

    const malloryItem = await addItem(mallory, (await ctx.prisma.collectionItem.findUniqueOrThrow({ where: { id: bobPokemonItem } })).cardId, {
      condition: 'RAW',
      listingStatus: 'FOR_TRADE',
    });
    await ctx
      .http()
      .post(`${API}/trades/${trade.id}/items`)
      .set(auth(alice))
      .send({ collectionItemId: malloryItem })
      .expect(404);
  });

  it('computes all totals and cash server-side', async () => {
    for (const id of [pikachuItem, sportsItem, onePieceItem, bobPokemonItem]) {
      const res = await ctx.http().post(`${API}/trades/${trade.id}/items`).set(auth(alice)).send({ collectionItemId: id }).expect(201);
      trade = res.body;
    }
    expect(trade.calculation).toEqual({
      initiatorTotalCents: 30000,
      counterpartyTotalCents: 28000,
      differenceCents: 2000,
      suggestedCashPayer: 'COUNTERPARTY',
      suggestedCashCents: 2000,
      hasUnpricedItems: false,
    });
    expect(trade.cash).toEqual({ payer: 'COUNTERPARTY', amountCents: 2000, isManual: false });
    expect(trade.finalValue).toEqual({ initiatorGivesCents: 30000, counterpartyGivesCents: 30000 });

    await ctx
      .http()
      .post(`${API}/trades/${trade.id}/items`)
      .set(auth(alice))
      .send({ collectionItemId: pikachuItem })
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('ITEM_ALREADY_IN_TRADE'));
  });

  it('accepts a manually agreed cash amount', async () => {
    const res = await ctx
      .http()
      .put(`${API}/trades/${trade.id}/cash`)
      .set(auth(bob))
      .send({ payer: 'COUNTERPARTY', amountCents: 1500 })
      .expect(200);
    trade = res.body;
    expect(trade.cash).toEqual({ payer: 'COUNTERPARTY', amountCents: 1500, isManual: true });
    expect(trade.calculation.suggestedCashCents).toBe(2000);
  });

  it('hides the trade from non-participants', async () => {
    await ctx.http().get(`${API}/trades/${trade.id}`).set(auth(mallory)).expect(404);
    await ctx.http().post(`${API}/trades/${trade.id}/cancel`).set(auth(mallory)).expect(404);
    await ctx
      .http()
      .post(`${API}/trades/${trade.id}/propose`)
      .set(auth(mallory))
      .send({ expectedVersion: trade.version })
      .expect(404);
  });

  it('requires the reviewed version to propose and accept', async () => {
    await ctx
      .http()
      .post(`${API}/trades/${trade.id}/propose`)
      .set(auth(alice))
      .send({ expectedVersion: trade.version - 1 })
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('TRADE_VERSION_MISMATCH'));

    const proposed = await ctx
      .http()
      .post(`${API}/trades/${trade.id}/propose`)
      .set(auth(alice))
      .send({ expectedVersion: trade.version })
      .expect(200);
    trade = proposed.body;
    expect(trade.status).toBe('PROPOSED');
    expect(trade.initiator.hasAcceptedCurrentVersion).toBe(true);

    // The proposer cannot accept their own proposal.
    await ctx.http().post(`${API}/trades/${trade.id}/accept`).set(auth(alice)).send({ expectedVersion: trade.version }).expect(409);
  });

  it('any edit after proposing resets the trade to DRAFT with a new version', async () => {
    const edited = await ctx
      .http()
      .put(`${API}/trades/${trade.id}/cash`)
      .set(auth(alice))
      .send({ payer: 'COUNTERPARTY', amountCents: 2000 })
      .expect(200);
    expect(edited.body.status).toBe('DRAFT');
    expect(edited.body.version).toBe(trade.version + 1);

    // Bob tries to accept the terms he saw before the change.
    await ctx.http().post(`${API}/trades/${trade.id}/accept`).set(auth(bob)).send({ expectedVersion: trade.version }).expect(409);
    trade = edited.body;
  });

  it('accepting locks the cards; terms stay editable and a change resets both acceptances', async () => {
    trade = (
      await ctx.http().post(`${API}/trades/${trade.id}/propose`).set(auth(alice)).send({ expectedVersion: trade.version }).expect(200)
    ).body;
    expect(trade.isCounterOffer).toBe(false);
    trade = (
      await ctx.http().post(`${API}/trades/${trade.id}/accept`).set(auth(bob)).send({ expectedVersion: trade.version }).expect(200)
    ).body;
    expect(trade.status).toBe('ACCEPTED');
    expect(trade.allowedActions).toEqual(['EDIT', 'COMPLETE', 'CANCEL']);
    await ctx
      .http()
      .delete(`${API}/collection/${pikachuItem}`)
      .set(auth(alice))
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('ITEM_LOCKED_IN_TRADE'));

    // Alice confirms receipt, then Bob changes the cash: everything resets.
    await ctx.http().post(`${API}/trades/${trade.id}/complete`).set(auth(alice)).expect(200);
    const changed = (
      await ctx.http().put(`${API}/trades/${trade.id}/cash`).set(auth(bob)).send({ payer: 'COUNTERPARTY', amountCents: 1800 }).expect(200)
    ).body as TradeResponse;
    expect(changed.status).toBe('DRAFT');
    expect(changed.version).toBe(trade.version + 1);
    expect(changed.initiator).toMatchObject({ hasAcceptedCurrentVersion: false, completionConfirmed: false });
    expect(changed.counterparty).toMatchObject({ hasAcceptedCurrentVersion: false, completionConfirmed: false });
    expect(changed.acceptedAt).toBeNull();

    const aliceInbox = await ctx.http().get(`${API}/notifications`).set(auth(alice)).expect(200);
    expect(aliceInbox.body.data[0]).toMatchObject({ type: 'TRADE_TERMS_CHANGED', data: { tradeId: trade.id } });
    trade = changed;
  });

  it('the other side sends the changed terms back as a counteroffer', async () => {
    trade = (
      await ctx.http().post(`${API}/trades/${trade.id}/propose`).set(auth(bob)).send({ expectedVersion: trade.version }).expect(200)
    ).body;
    expect(trade).toMatchObject({ status: 'PROPOSED', proposedByRole: 'COUNTERPARTY', proposalCount: 3, isCounterOffer: true });

    const aliceView = (await ctx.http().get(`${API}/trades/${trade.id}`).set(auth(alice)).expect(200)).body as TradeResponse;
    expect(aliceView.allowedActions).toEqual(['EDIT', 'ACCEPT', 'DECLINE', 'COUNTER', 'CANCEL']);

    const unread = await ctx.http().get(`${API}/notifications/unread-count`).set(auth(alice)).expect(200);
    expect(unread.body.count).toBeGreaterThanOrEqual(2);
    const inbox = await ctx.http().get(`${API}/notifications`).set(auth(alice)).expect(200);
    expect(inbox.body.data[0]).toMatchObject({ type: 'TRADE_COUNTER', title: 'Counteroffer received' });
    const afterRead = await ctx.http().post(`${API}/notifications/read`).set(auth(alice)).send({}).expect(200);
    expect(afterRead.body.count).toBe(0);

    trade = (
      await ctx.http().post(`${API}/trades/${trade.id}/accept`).set(auth(alice)).send({ expectedVersion: trade.version }).expect(200)
    ).body;
    expect(trade.status).toBe('ACCEPTED');
    // Final summary carries grades, cert numbers and the comps snapshot.
    expect(trade.initiator.items.every((i) => Array.isArray(i.comps))).toBe(true);
  });

  it('cannot be reviewed before completion', async () => {
    await ctx
      .http()
      .post(`${API}/trades/${trade.id}/reviews`)
      .set(auth(bob))
      .send({ rating: 5 })
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('TRADE_NOT_COMPLETED'));
  });

  it('completes only when both traders confirm, then transfers cards', async () => {
    const first = await ctx.http().post(`${API}/trades/${trade.id}/complete`).set(auth(alice)).expect(200);
    expect(first.body.status).toBe('ACCEPTED');
    await ctx.http().post(`${API}/trades/${trade.id}/complete`).set(auth(alice)).expect(409);

    const done = await ctx.http().post(`${API}/trades/${trade.id}/complete`).set(auth(bob)).expect(200);
    trade = done.body;
    expect(trade.status).toBe('COMPLETED');
    expect(trade.completedAt).not.toBeNull();

    const aliceItems = await ctx.prisma.collectionItem.findMany({ where: { userId: alice.userId }, include: { card: true } });
    expect(aliceItems.map((i) => i.card.name).sort()).toEqual(['Eevee', 'Luffy']);
    const luffy = aliceItems.find((i) => i.card.name === 'Luffy')!;
    expect(luffy).toMatchObject({ listingStatus: 'PERSONAL', purchasePriceCents: 25000, priceTierKey: 'RAW:NEAR_MINT' });

    const bobItems = await ctx.prisma.collectionItem.findMany({ where: { userId: bob.userId }, include: { card: true } });
    expect(bobItems.map((i) => i.card.name).sort()).toEqual(['Eevee', 'Pikachu', 'Rookie']);

    const profile = await ctx.http().get(`${API}/users/${alice.publicId}`).set(auth(bob)).expect(200);
    expect(profile.body.stats.completedTradeCount).toBe(1);
  });

  it('keeps historical trade values unchanged when prices move later', async () => {
    await ctx.prisma.cardMarketValue.updateMany({ data: { valueCents: 99_999 } });
    const history = await ctx.http().get(`${API}/trades/${trade.id}`).set(auth(alice)).expect(200);
    expect(history.body.calculation.initiatorTotalCents).toBe(30000);
    expect(history.body.initiator.items[0].unitValueCents).toBe(22000);

    const list = await ctx.http().get(`${API}/trades?scope=history`).set(auth(alice)).expect(200);
    expect(list.body.data[0]).toMatchObject({ id: trade.id, status: 'COMPLETED', myItemsTotalCents: 30000 });
  });

  it('enforces review rules', async () => {
    await ctx.http().post(`${API}/trades/${trade.id}/reviews`).set(auth(mallory)).send({ rating: 1 }).expect(404);
    await ctx.http().post(`${API}/trades/${trade.id}/reviews`).set(auth(alice)).send({ rating: 6 }).expect(400);

    const review = await ctx
      .http()
      .post(`${API}/trades/${trade.id}/reviews`)
      .set(auth(alice))
      .send({ rating: 5, comment: '  Smooth trade!  ' })
      .expect(201);
    expect(review.body).toMatchObject({ rating: 5, comment: 'Smooth trade!', verifiedTrade: true });

    await ctx
      .http()
      .post(`${API}/trades/${trade.id}/reviews`)
      .set(auth(alice))
      .send({ rating: 1 })
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('ALREADY_REVIEWED'));

    await ctx.http().post(`${API}/trades/${trade.id}/reviews`).set(auth(bob)).send({ rating: 4 }).expect(201);

    const bobProfile = await ctx.http().get(`${API}/users/${bob.publicId}`).set(auth(mallory)).expect(200);
    expect(bobProfile.body.stats).toEqual({ ratingAverage: 5, ratingCount: 1, completedTradeCount: 1 });

    const reviews = await ctx.http().get(`${API}/users/${bob.publicId}/reviews`).set(auth(mallory)).expect(200);
    expect(reviews.body.data).toHaveLength(1);
    expect(reviews.body.data[0].reviewer.publicId).toBe(alice.publicId);
  });

  it('declined trades cannot be revived', async () => {
    // bobPokemonItem moved to Alice in the completed trade; give Bob a fresh tradeable card.
    const cardId = await createCard(ctx.prisma, { name: 'Snorlax', values: { RAW: 1500 } });
    const bobItem = await addItem(bob, cardId, { condition: 'RAW', listingStatus: 'FOR_TRADE' });
    const t = (await ctx.http().post(`${API}/trades`).set(auth(mallory)).send({ counterpartyPublicId: bob.publicId }).expect(201)).body as TradeResponse;
    const withItem = (
      await ctx.http().post(`${API}/trades/${t.id}/items`).set(auth(mallory)).send({ collectionItemId: bobItem }).expect(201)
    ).body as TradeResponse;
    await ctx.http().post(`${API}/trades/${t.id}/propose`).set(auth(mallory)).send({ expectedVersion: withItem.version }).expect(200);
    await ctx.http().post(`${API}/trades/${t.id}/decline`).set(auth(bob)).expect(200);
    await ctx.http().post(`${API}/trades/${t.id}/cancel`).set(auth(mallory)).expect(409);
  });
});
