import { DAY_MS } from '../../../../common/utils/dates';
import type { PricingTarget } from '../price-provider.interface';
import { MockPriceProvider } from './mock-price.provider';

const target = (overrides: Partial<PricingTarget> = {}): PricingTarget => ({
  cardId: '00000000-0000-4000-8000-000000000001',
  category: 'POKEMON',
  name: 'Pikachu',
  setName: '151',
  setCode: 'SV3PT5',
  year: 2023,
  cardNumber: '173',
  variant: '',
  subject: 'Pikachu',
  rarity: 'Illustration Rare',
  tier: { kind: 'RAW', condition: 'NEAR_MINT' },
  tierKey: 'RAW:NEAR_MINT',
  ...overrides,
});

describe('MockPriceProvider', () => {
  const provider = new MockPriceProvider();
  const since = new Date(Date.now() - 120 * DAY_MS);

  it('is deterministic for the same card and tier', async () => {
    const a = await provider.getRecentSales(target(), since);
    const b = await provider.getRecentSales(target(), since);
    expect(a.length).toBeGreaterThan(10);
    expect(a).toEqual(b);
  });

  it('prices PSA 10 well above raw for the same card', async () => {
    const avg = (sales: { priceCents: number }[]) => sales.reduce((s, x) => s + x.priceCents, 0) / sales.length;
    const raw = await provider.getRecentSales(target(), since);
    const psa10 = await provider.getRecentSales(
      target({ tier: { kind: 'GRADED', company: 'PSA', grade: 10 }, tierKey: 'GRADED:PSA:10' }),
      since,
    );
    expect(avg(psa10)).toBeGreaterThan(avg(raw) * 2);
  });

  it('produces only past sales with unique references', async () => {
    const sales = await provider.getRecentSales(target(), since);
    expect(sales.every((s) => s.soldAt <= new Date() && s.soldAt >= since)).toBe(true);
    expect(new Set(sales.map((s) => s.sourceReference)).size).toBe(sales.length);
  });
});
