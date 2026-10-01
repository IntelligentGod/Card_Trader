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
 * so the MVP median can be swapped (weighted recency, outlier trimming,
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

/** MVP: median of the last N valid comparable sales (N = 3). */
export class MedianOfLastNStrategy implements MarketValueStrategy {
  readonly id: string;

  constructor(
    readonly sampleSize = 3,
    readonly maxAgeDays = 180,
    private readonly freshDays = 90,
  ) {
    this.id = `median-last-${sampleSize}@v1`;
  }

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
      valueCents: median(usable.map((s) => s.priceCents)),
      confidence,
      sampleSize: usable.length,
      lastSaleAt: usable[0]!.soldAt,
    };
  }
}
