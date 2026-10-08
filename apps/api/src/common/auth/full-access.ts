import type { UserRole } from '@card-trader/shared';

/**
 * Who may use the app beyond signing in and managing the account: everyone while the
 * paywall is switched off (PAYWALL_ENABLED=false, before the store products exist),
 * every admin, and USER accounts that bought the one-time unlock or were granted it.
 */
export function hasFullAccess(user: { role: UserRole; paidAt: Date | null }, paywallEnabled: boolean): boolean {
  return !paywallEnabled || user.role !== 'USER' || user.paidAt !== null;
}
