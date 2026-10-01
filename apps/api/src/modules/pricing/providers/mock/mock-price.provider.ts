import { Injectable } from '@nestjs/common';
import { tierLabel, type PriceTier, type RawCondition } from '@card-trader/shared';
import { DAY_MS } from '../../../../common/utils/dates';
import { BasePriceProvider, type NormalizedSale, type PricingTarget } from '../price-provider.interface';
import { hashString, randomFor, seededRandom } from './seeded-random';

interface MockSale {
  reference: string;
  priceCents: number;
  soldAt: Date;
  title: string;
  isOutlier: boolean;
  tier: PriceTier;
}

const RARITY_RANGES: Array<[RegExp, number, number]> = [
  [/special illustration|hyper|secret|sec\b|manga|gold|1\/1|superfractor/i, 8_000, 60_000],
  [/illustration rare|alt art|alternate art|ultra|sr\b|double rare|leader|auto/i, 2_500, 20_000],
  [/holo|refractor|prizm|silver|rookie|rc\b/i, 800, 8_000],
  [/rare/i, 300, 3_000],
  [/uncommon/i, 100, 600],
  [/common/i, 50, 300],
];
const ICONIC = /charizard|pikachu|mewtwo|umbreon|luffy|shanks|zoro|ace|jordan|brady|mahomes|ohtani|wembanyama|lebron/i;

const RAW_CONDITION_FACTOR: Record<RawCondition, number> = {
  RAW: 0.95,
  MINT: 1.1,
  NEAR_MINT: 1,
  EXCELLENT: 0.8,
  VERY_GOOD: 0.68,
  GOOD: 0.58,
  PLAYED: 0.4,
  POOR: 0.25,
};
const COMPANY_FACTOR: Record<string, number> = { PSA: 1, BGS: 0.95, CGC: 0.82, OTHER: 0.6 };

function gradeFactor(grade: number): number {
  if (grade >= 10) return 4;
  if (grade >= 9.5) return 2.8;
  if (grade >= 9) return 1.8;
  if (grade >= 8.5) return 1.4;
  if (grade >= 8) return 1.2;
  if (grade >= 7) return 0.95;
  return Math.max(0.3, (0.95 * grade) / 7);
}

/** Epoch day used as the zero point for each card's long-term trend. */
const TREND_ANCHOR_DAY = 20_000;

/**
 * Development provider: generates realistic, deterministic sold listings with
 * per-card trends, weekly-ish noise, and occasional bad matches, so charts,
 * valuation and filtering can be built without any external API.
 */
@Injectable()
export class MockPriceProvider extends BasePriceProvider<MockSale> {
  readonly code = 'MOCK';
  readonly displayName = 'Mock sales (development)';

  async searchSoldItems(target: PricingTarget, since: Date): Promise<MockSale[]> {
    const base = this.basePriceCents(target) * this.tierFactor(target.tier);
    const cardRandom = randomFor(`trend:${target.cardId}`);
    const driftPerDay = (cardRandom() - 0.4) * 0.9 / 365; // −36%..+45% per year, skewed upward
    const phase = cardRandom() * Math.PI * 2;
    const saleChance = target.tier.kind === 'GRADED' ? 0.18 : 0.3;

    const sales: MockSale[] = [];
    const firstDay = Math.floor(since.getTime() / DAY_MS);
    const lastDay = Math.floor(Date.now() / DAY_MS);
    for (let day = firstDay; day <= lastDay; day++) {
      const rnd = seededRandom(hashString(`${target.cardId}|${target.tierKey}|${day}`));
      if (rnd() > saleChance) continue;

      const trend = Math.exp(driftPerDay * (day - TREND_ANCHOR_DAY)) * (1 + 0.08 * Math.sin((2 * Math.PI * day) / 90 + phase));
      const noise = 0.88 + rnd() * 0.24;
      const outlierRoll = rnd();
      const isOutlier = outlierRoll < 0.03;
      const outlierFactor = isOutlier ? (outlierRoll < 0.015 ? 0.3 : 2.6) : 1;
      const priceCents = Math.max(99, Math.round((base * trend * noise * outlierFactor) / 100) * 100 - (rnd() < 0.5 ? 1 : 0));
      const soldAt = new Date(day * DAY_MS + Math.floor(rnd() * DAY_MS));
      if (soldAt > new Date()) continue;

      sales.push({
        reference: `mock:${target.cardId}:${target.tierKey}:${day}`,
        priceCents,
        soldAt,
        title: `${isOutlier ? 'LOT ' : ''}${target.name} ${target.setName} #${target.cardNumber} ${tierLabel(target.tier)}`,
        isOutlier,
        tier: target.tier,
      });
    }
    return sales;
  }

  normalizeSale(raw: MockSale): NormalizedSale | null {
    return {
      sourceReference: raw.reference,
      priceCents: raw.priceCents,
      currency: 'USD',
      soldAt: raw.soldAt,
      tier: raw.tier,
      listingTitle: raw.title,
      // Outliers look like lots / mismatched listings and fall below the match threshold.
      matchConfidence: raw.isOutlier ? 0.4 : 0.95,
    };
  }

  private basePriceCents(target: PricingTarget): number {
    const descriptor = `${target.rarity ?? ''} ${target.variant}`;
    const range = RARITY_RANGES.find(([pattern]) => pattern.test(descriptor)) ?? [null, 500, 6_000];
    const [, min, max] = range;
    const r = randomFor(`base:${target.cardId}`)();
    let cents = Math.exp(Math.log(min) + r * (Math.log(max) - Math.log(min)));
    if (ICONIC.test(`${target.name} ${target.subject ?? ''}`)) cents *= 2.2;
    return cents;
  }

  private tierFactor(tier: PriceTier): number {
    if (tier.kind === 'RAW') return RAW_CONDITION_FACTOR[tier.condition] ?? 1;
    return gradeFactor(tier.grade) * (COMPANY_FACTOR[tier.company] ?? 0.6);
  }
}
