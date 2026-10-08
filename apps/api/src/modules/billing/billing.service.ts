import { Injectable, Logger } from '@nestjs/common';
import type { BillingStatusResponse, PaidVia } from '@card-trader/shared';
import { hasFullAccess } from '../../common/auth/full-access';
import { Errors } from '../../common/errors/app.exception';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const REVENUECAT_API = 'https://api.revenuecat.com/v1';
const STORE_TIMEOUT_MS = 10_000;

/** Webhook events that mean the entitlement is (still) owned, and those that take it away. */
const GRANT_EVENTS = new Set(['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'TRANSFER', 'TEST']);
const REVOKE_EVENTS = new Set(['EXPIRATION']);

interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  entitlement_ids?: string[] | null;
  product_id?: string;
  store?: string;
  cancel_reason?: string;
}

interface RevenueCatSubscriber {
  subscriber?: {
    entitlements?: Record<string, { expires_date: string | null; product_identifier?: string }>;
    non_subscriptions?: Record<string, { store?: string }[]>;
  };
}

/** Maps RevenueCat's store names to what the admin console shows. */
function paidViaFromStore(store: string | undefined): PaidVia {
  const s = (store ?? '').toUpperCase();
  if (s === 'APP_STORE' || s === 'MAC_APP_STORE') return 'APP_STORE';
  if (s === 'PLAY_STORE') return 'PLAY_STORE';
  return 'APP_STORE';
}

/**
 * The one-time unlock. The stores are the source of truth: the app buys through
 * Google Play / the App Store, RevenueCat verifies the receipt, and this service records
 * the result on the account (webhook + the app's `sync` call after a purchase), so the
 * unlock follows the Card Trader account across devices and platforms.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly notifications: NotificationsService,
  ) {}

  get paywallEnabled(): boolean {
    return this.config.get('PAYWALL_ENABLED');
  }

  get entitlementId(): string {
    return this.config.get('PURCHASE_ENTITLEMENT_ID');
  }

  private get secretKey(): string | undefined {
    return this.config.get('REVENUECAT_SECRET_KEY') || undefined;
  }

  private get webhookSecret(): string | undefined {
    return this.config.get('REVENUECAT_WEBHOOK_SECRET') || undefined;
  }

  async status(userId: string): Promise<BillingStatusResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true, paidAt: true, paidVia: true } });
    return {
      hasFullAccess: hasFullAccess(user, this.paywallEnabled),
      paywallEnabled: this.paywallEnabled,
      storeConfigured: this.secretKey !== undefined,
      entitlementId: this.entitlementId,
      paidAt: user.paidAt?.toISOString() ?? null,
      paidVia: (user.paidVia as PaidVia | null) ?? null,
    };
  }

  /** Records the unlock. An existing purchase date is kept (the first purchase counts). */
  async grant(userId: string, via: PaidVia, tx: Tx | PrismaService = this.prisma): Promise<boolean> {
    const result = await tx.user.updateMany({ where: { id: userId, paidAt: null }, data: { paidAt: new Date(), paidVia: via } });
    if (result.count === 0) return false;
    await this.notifications.notify(tx, { userId, type: 'ACCOUNT_SECURITY', title: 'Card Trader unlocked', body: 'Thanks for your purchase — every feature is now available.' });
    return true;
  }

  /** Takes the unlock away after a refund/expiry. Admin grants are never revoked by the store. */
  async revoke(userId: string, tx: Tx | PrismaService = this.prisma): Promise<boolean> {
    const result = await tx.user.updateMany({ where: { id: userId, paidAt: { not: null }, paidVia: { not: 'ADMIN' } }, data: { paidAt: null, paidVia: null } });
    return result.count > 0;
  }

  /**
   * After a purchase or "Restore purchases" the app calls this: the server asks RevenueCat
   * whether the account (app user id = publicId) owns the entitlement, so a modified app
   * can't unlock itself, and the unlock applies immediately instead of when the webhook lands.
   */
  async syncFromStore(userId: string, publicId: string): Promise<void> {
    const key = this.secretKey;
    if (!key) throw Errors.serviceUnavailable('BILLING_NOT_CONFIGURED', 'Purchases are not available yet');

    let data: RevenueCatSubscriber;
    try {
      const response = await fetch(`${REVENUECAT_API}/subscribers/${encodeURIComponent(publicId)}`, {
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(STORE_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`RevenueCat answered ${response.status}`);
      data = (await response.json()) as RevenueCatSubscriber;
    } catch (error) {
      this.logger.error(`RevenueCat lookup for ${publicId} failed: ${String(error)}`);
      throw Errors.serviceUnavailable('BILLING_UNAVAILABLE', "Couldn't confirm the purchase right now. Please try again.");
    }

    const entitlement = data.subscriber?.entitlements?.[this.entitlementId];
    const active = !!entitlement && (entitlement.expires_date === null || new Date(entitlement.expires_date) > new Date());
    if (!active) throw Errors.paymentRequired('No purchase was found for this account. Buy the unlock, or restore it on the device you bought it with.');

    const purchases = entitlement.product_identifier ? data.subscriber?.non_subscriptions?.[entitlement.product_identifier] : undefined;
    await this.grant(userId, paidViaFromStore(purchases?.at(-1)?.store));
  }

  /** RevenueCat → server. Authenticated with the shared secret set as the webhook's Authorization header. */
  async handleWebhook(authorization: string | undefined, body: { event?: RevenueCatEvent } | undefined): Promise<{ handled: boolean }> {
    const secret = this.webhookSecret;
    if (!secret) throw Errors.serviceUnavailable('BILLING_NOT_CONFIGURED', 'Webhook secret is not configured');
    const presented = authorization?.replace(/^Bearer\s+/i, '').trim();
    if (presented !== secret) throw Errors.unauthorized('WEBHOOK_UNAUTHORIZED', 'Bad webhook secret');

    const event = body?.event;
    const type = event?.type ?? '';
    const entitled = event?.entitlement_ids?.includes(this.entitlementId) ?? false;
    if (!(GRANT_EVENTS.has(type) || REVOKE_EVENTS.has(type) || type === 'CANCELLATION')) return { handled: false };

    const ids = [event?.app_user_id, event?.original_app_user_id, ...(event?.aliases ?? [])].filter((id): id is string => typeof id === 'string' && id.length > 0);
    const user = ids.length ? await this.prisma.user.findFirst({ where: { publicId: { in: ids } }, select: { id: true, publicId: true } }) : null;
    if (!user) {
      this.logger.warn(`RevenueCat ${type} for unknown app user ${ids.join(',') || '(none)'}`);
      return { handled: false };
    }

    if (GRANT_EVENTS.has(type) && entitled) {
      const changed = await this.grant(user.id, paidViaFromStore(event?.store));
      this.logger.log(`Unlock ${changed ? 'recorded' : 'already present'} for ${user.publicId} via ${type}`);
      return { handled: true };
    }
    // A refund arrives as CANCELLATION (cancel_reason CUSTOMER_SUPPORT) followed by EXPIRATION.
    if (REVOKE_EVENTS.has(type) || (type === 'CANCELLATION' && event?.cancel_reason === 'CUSTOMER_SUPPORT')) {
      if (entitled || !event?.entitlement_ids) {
        const changed = await this.revoke(user.id);
        this.logger.log(`Unlock ${changed ? 'revoked' : 'unchanged'} for ${user.publicId} via ${type}`);
      }
      return { handled: true };
    }
    return { handled: false };
  }
}
