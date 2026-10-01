import { API, auth, createCard, createTestApp, registerUser, resetDatabase, type TestContext, type TestUser } from './utils';

describe('Collection & portfolio (e2e)', () => {
  let ctx: TestContext;
  let owner: TestUser;
  let other: TestUser;
  let cardId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    owner = await registerUser(ctx, 'Owner');
    other = await registerUser(ctx, 'Other');
    cardId = await createCard(ctx.prisma, { values: { 'GRADED:PSA:10': 22000, 'RAW:NEAR_MINT': 4000 } });
  });
  afterAll(async () => ctx.app.close());

  it('adds cards, derives the price tier server-side, and caches the estimate', async () => {
    const graded = await ctx
      .http()
      .post(`${API}/collection`)
      .set(auth(owner))
      .send({ cardId, condition: 'GRADED', gradingCompany: 'PSA', grade: 10, certNumber: '12345678', listingStatus: 'FOR_TRADE', purchasePriceCents: 15000 })
      .expect(201);
    expect(graded.body).toMatchObject({ tierKey: 'GRADED:PSA:10', tierLabel: 'PSA 10', estimatedValueCents: 22000 });

    const raw = await ctx
      .http()
      .post(`${API}/collection`)
      .set(auth(owner))
      .send({ cardId, condition: 'NEAR_MINT', quantity: 3, listingStatus: 'FOR_SALE', askingPriceCents: 4500 })
      .expect(201);
    expect(raw.body).toMatchObject({ tierKey: 'RAW:NEAR_MINT', totalValueCents: 12000 });

    await ctx.http().post(`${API}/collection`).set(auth(owner)).send({ cardId, condition: 'PRIVATE_NOTE' }).expect(400);
  });

  it('never compares raw with graded: grading fields must be consistent', async () => {
    await ctx
      .http()
      .post(`${API}/collection`)
      .set(auth(owner))
      .send({ cardId, condition: 'NEAR_MINT', gradingCompany: 'PSA', grade: 10 })
      .expect(400)
      .expect((r) => expect(r.body.code).toBe('INVALID_GRADING'));
    await ctx
      .http()
      .post(`${API}/collection`)
      .set(auth(owner))
      .send({ cardId, condition: 'GRADED', gradingCompany: 'PSA', grade: 10, quantity: 2 })
      .expect(400)
      .expect((r) => expect(r.body.code).toBe('GRADED_QUANTITY'));
  });

  it('prevents IDOR: other users cannot read, edit, or delete my items', async () => {
    const list = await ctx.http().get(`${API}/collection`).set(auth(owner)).expect(200);
    const itemId = list.body.data[0].id as string;

    await ctx.http().get(`${API}/collection/${itemId}`).set(auth(other)).expect(404);
    await ctx.http().patch(`${API}/collection/${itemId}`).set(auth(other)).send({ quantity: 1 }).expect(404);
    await ctx.http().delete(`${API}/collection/${itemId}`).set(auth(other)).expect(404);
    await ctx.http().get(`${API}/collection/${itemId}`).set(auth(owner)).expect(200);
  });

  it('shows other users only cards for trade/sale, without private data', async () => {
    await ctx
      .http()
      .post(`${API}/collection`)
      .set(auth(owner))
      .send({ cardId, condition: 'EXCELLENT', listingStatus: 'PERSONAL', notes: 'secret' })
      .expect(201);

    const pub = await ctx.http().get(`${API}/users/${owner.publicId}/collection`).set(auth(other)).expect(200);
    expect(pub.body.data).toHaveLength(2);
    expect(JSON.stringify(pub.body)).not.toMatch(/purchasePrice|secret|notes/);

    const tradeable = await ctx
      .http()
      .get(`${API}/users/${owner.publicId}/collection?availability=trade`)
      .set(auth(other))
      .expect(200);
    expect(tradeable.body.data).toHaveLength(1);
    expect(tradeable.body.data[0]).toMatchObject({ listingStatus: 'FOR_TRADE', certNumber: '12345678' });

    const forSale = await ctx
      .http()
      .get(`${API}/users/${owner.publicId}/collection?availability=sale`)
      .set(auth(other))
      .expect(200);
    expect(forSale.body.data).toHaveLength(1);
    expect(forSale.body.data[0]).toMatchObject({ listingStatus: 'FOR_SALE', askingPriceCents: 4500 });

    const profile = await ctx.http().get(`${API}/users/${owner.publicId}`).set(auth(other)).expect(200);
    expect(profile.body).toMatchObject({ availableCount: 2, forTradeCount: 1, forSaleCount: 1 });
  });

  it('summarizes total value by category', async () => {
    const summary = await ctx.http().get(`${API}/portfolio/summary`).set(auth(owner)).expect(200);
    // PSA 10 ($220) + 3 × NM ($40) + unpriced Excellent
    expect(summary.body.totalValueCents).toBe(34000);
    expect(summary.body.cardCount).toBe(5);
    expect(summary.body.unpricedCount).toBe(1);
    expect(summary.body.byCategory.find((c: { category: string }) => c.category === 'POKEMON').valueCents).toBe(34000);
    expect(summary.body.disclaimer).toContain('estimates');

    const top = await ctx.http().get(`${API}/portfolio/top-cards?limit=1`).set(auth(owner)).expect(200);
    expect(top.body[0].totalValueCents).toBe(22000);
  });

  it('reports market movement on current holdings, not additions', async () => {
    const baselineDay = new Date(Date.now() - 35 * 86_400_000);
    const day = new Date(Date.UTC(baselineDay.getUTCFullYear(), baselineDay.getUTCMonth(), baselineDay.getUTCDate()));
    await ctx.prisma.cardMarketValueDaily.create({
      data: { cardId, priceTierKey: 'GRADED:PSA:10', date: day, valueCents: 20000 },
    });
    const summary = await ctx.http().get(`${API}/portfolio/summary`).set(auth(owner)).expect(200);
    // Only the PSA 10 has a 30-day baseline: $220 now vs $200 then.
    expect(summary.body.change['30d']).toEqual({ amountCents: 2000, percent: 10 });

    const movers = await ctx.http().get(`${API}/portfolio/movers?direction=up&window=30d`).set(auth(owner)).expect(200);
    expect(movers.body[0]).toMatchObject({ changeCents: 2000, previousValueCents: 20000, currentValueCents: 22000 });
  });

  it('blocks deleting an item and cascades removal from open trades', async () => {
    const item = await ctx
      .http()
      .post(`${API}/collection`)
      .set(auth(owner))
      .send({ cardId, condition: 'RAW', listingStatus: 'FOR_TRADE' })
      .expect(201);
    const trade = await ctx.http().post(`${API}/trades`).set(auth(other)).send({ counterpartyPublicId: owner.publicId }).expect(201);
    await ctx
      .http()
      .post(`${API}/trades/${trade.body.id}/items`)
      .set(auth(other))
      .send({ collectionItemId: item.body.id })
      .expect(201);

    await ctx
      .http()
      .patch(`${API}/collection/${item.body.id}`)
      .set(auth(owner))
      .send({ condition: 'POOR' })
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('ITEM_IN_ACTIVE_TRADE'));

    await ctx.http().delete(`${API}/collection/${item.body.id}`).set(auth(owner)).expect(204);
    const after = await ctx.http().get(`${API}/trades/${trade.body.id}`).set(auth(other)).expect(200);
    expect(after.body.counterparty.items).toHaveLength(0);
  });
});
