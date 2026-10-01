import { Test } from '@nestjs/testing';
import type { INestApplicationContext } from '@nestjs/common';
import { AppConfigModule } from '../src/config/config.module';
import { DailySnapshotService } from '../src/modules/pricing/jobs/daily-snapshot.service';
import { PriceRefreshService } from '../src/modules/pricing/jobs/price-refresh.service';
import { PricingModule } from '../src/modules/pricing/pricing.module';
import { MockPriceProvider } from '../src/modules/pricing/providers/mock/mock-price.provider';
import { PRICE_PROVIDERS } from '../src/modules/pricing/providers/price-provider.interface';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { API, auth, createCard, createTestApp, registerUser, resetDatabase, type TestContext } from './utils';

/**
 * Drives the real worker pipeline (claim → mock provider → sales → estimate →
 * daily series → collection items) and then reads the results through the API.
 */
describe('Pricing worker (e2e)', () => {
  let ctx: TestContext;
  let worker: INestApplicationContext;
  let prisma: PrismaService;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule, PricingModule],
      providers: [
        MockPriceProvider,
        { provide: PRICE_PROVIDERS, inject: [MockPriceProvider], useFactory: (mock: MockPriceProvider) => [mock] },
        PriceRefreshService,
        DailySnapshotService,
      ],
    }).compile();
    worker = await moduleRef.init();
    prisma = worker.get(PrismaService);
  });
  afterAll(async () => {
    await worker.close();
    await ctx.app.close();
  });

  it('prices a newly collected card in the background and exposes history', async () => {
    const user = await registerUser(ctx, 'Pricer');
    const cardId = await createCard(ctx.prisma, { name: 'Charizard' });

    const created = await ctx
      .http()
      .post(`${API}/collection`)
      .set(auth(user))
      .send({ cardId, condition: 'GRADED', gradingCompany: 'PSA', grade: 10 })
      .expect(201);
    expect(created.body.estimatedValueCents).toBeNull();

    // Adding the card queued a refresh; the worker claims and processes it.
    const queued = await prisma.cardMarketValue.findUniqueOrThrow({
      where: { cardId_priceTierKey: { cardId, priceTierKey: 'GRADED:PSA:10' } },
    });
    expect(queued.nextRefreshAt.getTime()).toBeLessThanOrEqual(Date.now());

    const processed = await worker.get(PriceRefreshService).runBatch();
    expect(processed).toBeGreaterThanOrEqual(1);

    const value = await prisma.cardMarketValue.findUniqueOrThrow({ where: { id: queued.id } });
    expect(value.valueCents).toBeGreaterThan(0);
    expect(value.algorithm).toBe('median-last-3@v1');
    expect(value.lockedUntil).toBeNull();
    expect(value.nextRefreshAt.getTime()).toBeGreaterThan(Date.now());

    // Sales are history, never overwritten; only PSA 10 sales are used.
    const sales = await prisma.cardPriceHistory.findMany({ where: { cardId } });
    expect(sales.length).toBeGreaterThan(10);
    expect(new Set(sales.map((s) => s.priceTierKey))).toEqual(new Set(['GRADED:PSA:10']));

    const item = await ctx.http().get(`${API}/collection/${created.body.id}`).set(auth(user)).expect(200);
    expect(item.body.estimatedValueCents).toBe(value.valueCents);

    const market = await ctx.http().get(`${API}/collection/${created.body.id}/market-value`).set(auth(user)).expect(200);
    expect(market.body.recentSales).toHaveLength(3);
    expect(market.body.valueCents).toBe(value.valueCents);

    const history = await ctx.http().get(`${API}/collection/${created.body.id}/price-history?range=3m`).set(auth(user)).expect(200);
    expect(history.body.points.length).toBeGreaterThan(60);

    // Idempotent: a second run on the same data does not duplicate sales.
    await prisma.cardMarketValue.update({ where: { id: queued.id }, data: { nextRefreshAt: new Date() } });
    await worker.get(PriceRefreshService).runBatch();
    expect(await prisma.cardPriceHistory.count({ where: { cardId } })).toBe(sales.length);

    // Nightly snapshot feeds the portfolio chart.
    await worker.get(DailySnapshotService).run();
    expect(await prisma.portfolioSnapshot.count({ where: { userId: user.userId } })).toBe(1);
  });
});
