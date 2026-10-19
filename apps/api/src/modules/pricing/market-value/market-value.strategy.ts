import type { ValueConfidence } from '@card-trader/shared';
import { DAY_MS } from '../../../common/utils/dates';

export interface ComparableSale {
  priceCents: number;
  soldAt: Date;
}

export interface MarketEstimate {
  valueCents: number | null;
  confidence: ValueConfidence;
  sampleSize: number;
  lastSaleAt: Date | null;
}

/**
 * Pluggable valuation algorithm. MarketValueService depends on this interface,
 * so the valuation (average, median) can be swapped (weighted recency, outlier trimming,
 * multi-source blending...) without touching callers. The id is stored on each
 * estimate so we always know which algorithm produced a value.
 */
export interface MarketValueStrategy {
  readonly id: string;
  /** How many recent comparable sales the strategy wants. */
  readonly sampleSize: number;
  /** Sales older than this are not comparable. */
  readonly maxAgeDays: number;
  /** `sales` are comparable sales for one card + tier, newest first. */
  estimate(sales: readonly ComparableSale[], asOf: Date): MarketEstimate;
}

export const MARKET_VALUE_STRATEGY = Symbol('MARKET_VALUE_STRATEGY');

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

export function average(values: readonly number[]): number {
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** Combines the last N valid comparable sales into one value; subclasses choose how. */
abstract class LastNStrategy implements MarketValueStrategy {
  readonly id: string;

  constructor(
    name: string,
    readonly sampleSize: number,
    readonly maxAgeDays: number,
    private readonly freshDays: number,
  ) {
    this.id = `${name}-last-${sampleSize}@v1`;
  }

  protected abstract combine(prices: readonly number[]): number;

  estimate(sales: readonly ComparableSale[], asOf: Date): MarketEstimate {
    const oldest = asOf.getTime() - this.maxAgeDays * DAY_MS;
    const usable = sales
      .filter((s) => s.soldAt.getTime() <= asOf.getTime() && s.soldAt.getTime() >= oldest && s.priceCents > 0)
      .sort((a, b) => b.soldAt.getTime() - a.soldAt.getTime())
      .slice(0, this.sampleSize);

    if (usable.length === 0) return { valueCents: null, confidence: 'NONE', sampleSize: 0, lastSaleAt: null };

    const freshCutoff = asOf.getTime() - this.freshDays * DAY_MS;
    const allFresh = usable.every((s) => s.soldAt.getTime() >= freshCutoff);
    const confidence: ValueConfidence =
      usable.length < this.sampleSize ? 'LOW' : allFresh ? 'HIGH' : 'MEDIUM';

    return {
      valueCents: this.combine(usable.map((s) => s.priceCents)),
      confidence,
      sampleSize: usable.length,
      lastSaleAt: usable[0]!.soldAt,
    };
  }
}

/** Median of the last N valid comparable sales (the original MVP valuation). */
export class MedianOfLastNStrategy extends LastNStrategy {
  constructor(sampleSize = 3, maxAgeDays = 180, freshDays = 90) {
    super('median', sampleSize, maxAgeDays, freshDays);
  }

  protected combine(prices: readonly number[]): number {
    return median(prices);
  }
}

/** Suggested price: the average of the last N valid comparable sales (N = 3). */
export class AverageOfLastNStrategy extends LastNStrategy {
  constructor(sampleSize = 3, maxAgeDays = 180, freshDays = 90) {
    super('average', sampleSize, maxAgeDays, freshDays);
  }

  protected combine(prices: readonly number[]): number {
    return average(prices);
  }
}
