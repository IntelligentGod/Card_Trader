import type { CardCategory, PriceTier } from '@card-trader/shared';

/** Everything a provider needs to look up comparable sales for one card + tier. */
export interface PricingTarget {
  cardId: string;
  category: CardCategory;
  name: string;
  setName: string;
  setCode: string;
  year: number | null;
  cardNumber: string;
  variant: string;
  subject: string | null;
  rarity: string | null;
  tier: PriceTier;
  tierKey: string;
}

/** A completed sale normalized into our domain. */
export interface NormalizedSale {
  sourceReference: string;
  priceCents: number;
  currency: 'USD';
  soldAt: Date;
  /** Tier detected from the listing; may differ from the requested tier. */
  tier: PriceTier;
  listingTitle: string | null;
  /** 0..1 — how confident we are that the listing is exactly this card. */
  matchConfidence: number;
}

/**
 * Adapter contract for an external sold-price source. The rest of the app only
 * sees NormalizedSale; nothing outside pricing/providers knows about eBay etc.
 *
 * Implementations MUST respect the source's API terms, authentication, and
 * rate limits. Sources without an authorized API get no implementation.
 */
export interface PriceProvider {
  readonly code: string;
  readonly displayName: string;
  getRecentSales(target: PricingTarget, since: Date): Promise<NormalizedSale[]>;
}

/** Template: providers implement search + normalize; getRecentSales composes them. */
export abstract class BasePriceProvider<TRaw> implements PriceProvider {
  abstract readonly code: string;
  abstract readonly displayName: string;

  /** Fetch raw completed-sale records from the source. */
  abstract searchSoldItems(target: PricingTarget, since: Date): Promise<TRaw[]>;

  /** Map one raw record to a NormalizedSale, or null when it is not usable (lot, wrong card, no price...). */
  abstract normalizeSale(raw: TRaw, target: PricingTarget): NormalizedSale | null;

  async getRecentSales(target: PricingTarget, since: Date): Promise<NormalizedSale[]> {
    const raws = await this.searchSoldItems(target, since);
    const sales: NormalizedSale[] = [];
    for (const raw of raws) {
      const sale = this.normalizeSale(raw, target);
      if (sale && sale.priceCents > 0 && sale.soldAt >= since && sale.soldAt <= new Date()) sales.push(sale);
    }
    return sales;
  }
}

export const PRICE_PROVIDERS = Symbol('PRICE_PROVIDERS');
