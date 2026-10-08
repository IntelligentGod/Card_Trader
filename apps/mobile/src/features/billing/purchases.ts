import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

/**
 * The one-time unlock, bought through Google Play / the App Store via RevenueCat.
 *
 * The RevenueCat "app user id" is the Card Trader publicId, so a purchase is tied to the
 * account (not the phone) and the server can confirm it. Without the public SDK keys
 * (EXPO_PUBLIC_REVENUECAT_*_KEY) — e.g. a build made before the stores are set up —
 * every function here is a safe no-op and the unlock screen says purchases aren't available.
 */
export const ENTITLEMENT_ID = 'full_access';
/** Shown until the store reports the real, localized price. */
export const DEFAULT_PRICE_LABEL = '$4.99';

const apiKey = Platform.select({
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
});
export const purchasesAvailable = !!apiKey;

let identifiedAs: string | null = null;

/** Attaches the store SDK to the signed-in account. Call on every sign-in; cheap when nothing changed. */
export async function identifyPurchaser(publicId: string): Promise<void> {
  if (!apiKey || identifiedAs === publicId) return;
  try {
    if (identifiedAs === null) {
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.WARN : LOG_LEVEL.ERROR);
      Purchases.configure({ apiKey, appUserID: publicId });
    } else {
      await Purchases.logIn(publicId);
    }
    identifiedAs = publicId;
  } catch (error) {
    console.warn('Purchases: could not identify the account', error);
  }
}

/** On sign-out, so the next account on this phone doesn't inherit the purchase. */
export async function resetPurchaser(): Promise<void> {
  if (!apiKey || identifiedAs === null) return;
  identifiedAs = null;
  try {
    await Purchases.logOut();
  } catch {
    // Already anonymous: nothing to do.
  }
}

/** The package that grants the unlock (the "lifetime" one, or the first in the current offering). */
export async function getUnlockPackage(): Promise<PurchasesPackage | null> {
  if (!apiKey) return null;
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  return current?.lifetime ?? current?.availablePackages[0] ?? null;
}

export const ownsUnlock = (info: CustomerInfo): boolean => !!info.entitlements.active[ENTITLEMENT_ID];

/** Opens the store's purchase sheet. 'cancelled' when the user backs out. */
export async function purchaseUnlock(pkg: PurchasesPackage): Promise<'purchased' | 'cancelled'> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return ownsUnlock(customerInfo) ? 'purchased' : 'cancelled';
  } catch (error) {
    if ((error as { userCancelled?: boolean }).userCancelled) return 'cancelled';
    throw error;
  }
}

/** Re-reads purchases from the store account on this phone (Apple requires this button). */
export async function restoreUnlock(): Promise<boolean> {
  if (!apiKey) return false;
  return ownsUnlock(await Purchases.restorePurchases());
}
