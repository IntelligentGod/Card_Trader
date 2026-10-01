import { Injectable, Logger } from '@nestjs/common';
import { tierLabel } from '@card-trader/shared';
import { AppConfig } from '../../../../config/app-config.service';
import { detectTier, isExcludedListing, matchConfidence } from '../listing-matcher';
import { BasePriceProvider, type NormalizedSale, type PricingTarget } from '../price-provider.interface';
import { ProviderRateLimitedError, TokenBucket } from '../rate-limiter';

/**
 * eBay sold-listing data via the Marketplace Insights API.
 *
 * IMPORTANT: Marketplace Insights is a limited-release API — your eBay developer
 * application must be approved for the `buy.marketplace.insights` scope, and use
 * must follow the eBay API License Agreement (display, caching and attribution
 * rules). The legacy Finding API `findCompletedItems` has been decommissioned.
 * Verify endpoint and field names against eBay's current docs when access is
 * granted; this adapter isolates any differences to this one file.
 */

interface EbayItemSale {
  itemId: string;
  title?: string;
  lastSoldDate?: string;
  lastSoldPrice?: { value?: string; currency?: string };
  totalSoldQuantity?: number;
}

interface EbaySearchResponse {
  itemSales?: EbayItemSale[];
  next?: string;
}

const API_BASE = 'https://api.ebay.com';
const SCOPE = 'https://api.ebay.com/oauth/api_scope/buy.marketplace.insights';
/** eBay leaf categories (verify for your marketplace): CCG individual cards / sports card singles. */
const CATEGORY_IDS: Record<PricingTarget['category'], string> = {
  POKEMON: '183454',
  ONE_PIECE: '183454',
  SPORTS: '261328',
};
const MAX_PAGES = 3;
const PAGE_SIZE = 100;

@Injectable()
export class EbayPriceProvider extends BasePriceProvider<EbayItemSale> {
  readonly code = 'EBAY';
  readonly displayName = 'eBay sold listings';
  private readonly logger = new Logger(EbayPriceProvider.name);
  private readonly limiter: TokenBucket;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: AppConfig) {
    super();
    this.limiter = TokenBucket.perMinute(this.config.get('EBAY_REQUESTS_PER_MINUTE'));
  }

  get isConfigured(): boolean {
    return !!this.config.get('EBAY_CLIENT_ID') && !!this.config.get('EBAY_CLIENT_SECRET');
  }

  async searchSoldItems(target: PricingTarget, since: Date): Promise<EbayItemSale[]> {
    const params = new URLSearchParams({
      q: this.buildQuery(target),
      category_ids: CATEGORY_IDS[target.category],
      filter: `lastSoldDate:[${since.toISOString()}..]`,
      limit: String(PAGE_SIZE),
    });
    let url: string | null = `${API_BASE}/buy/marketplace_insights/v1_beta/item_sales/search?${params.toString()}`;
    const results: EbayItemSale[] = [];

    for (let page = 0; url && page < MAX_PAGES; page++) {
      const body: EbaySearchResponse = await this.getJson<EbaySearchResponse>(url);
      results.push(...(body.itemSales ?? []));
      url = body.next ?? null;
    }
    return results;
  }

  normalizeSale(raw: EbayItemSale, target: PricingTarget): NormalizedSale | null {
    const title = raw.title?.trim();
    const value = raw.lastSoldPrice?.value;
    if (!title || !value || !raw.lastSoldDate) return null;
    if (raw.lastSoldPrice?.currency && raw.lastSoldPrice.currency !== 'USD') return null;
    if (isExcludedListing(title)) return null;

    const priceCents = Math.round(Number(value) * 100);
    const soldAt = new Date(raw.lastSoldDate);
    if (!Number.isFinite(priceCents) || priceCents <= 0 || Number.isNaN(soldAt.getTime())) return null;

    return {
      sourceReference: `${raw.itemId}:${soldAt.getTime()}`.slice(0, 120),
      priceCents,
      currency: 'USD',
      soldAt,
      tier: detectTier(title),
      listingTitle: title.slice(0, 300),
      matchConfidence: matchConfidence(title, target),
    };
  }

  private buildQuery(target: PricingTarget): string {
    const parts = [target.subject ?? target.name, target.setName, target.cardNumber];
    if (target.variant) parts.push(target.variant);
    if (target.tier.kind === 'GRADED') parts.push(tierLabel(target.tier));
    else parts.push('-PSA -BGS -CGC -SGC');
    return parts.join(' ').slice(0, 100);
  }

  private async getJson<T>(url: string): Promise<T> {
    await this.limiter.acquire();
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${await this.accessToken()}`,
        'X-EBAY-C-MARKETPLACE-ID': this.config.get('EBAY_MARKETPLACE_ID'),
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after'));
      throw new ProviderRateLimitedError(this.code, Number.isFinite(retryAfter) ? retryAfter * 1000 : null);
    }
    if (response.status === 401) this.token = null;
    if (!response.ok) throw new Error(`eBay request failed with HTTP ${response.status}`);
    return (await response.json()) as T;
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    if (!this.isConfigured) throw new Error('eBay credentials are not configured');

    const basic = Buffer.from(`${this.config.get('EBAY_CLIENT_ID')}:${this.config.get('EBAY_CLIENT_SECRET')}`).toString(
      'base64',
    );
    await this.limiter.acquire();
    const response = await fetch(`${API_BASE}/identity/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: SCOPE }).toString(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      this.logger.error(`eBay OAuth failed with HTTP ${response.status}`);
      throw new Error('eBay authentication failed');
    }
    const body = (await response.json()) as { access_token: string; expires_in: number };
    this.token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return this.token.value;
  }
}
