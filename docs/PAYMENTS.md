# One-time purchase ($4.99 unlock)

Card Trader is free to download. After signing up, a user sees the **Unlock Card Trader**
screen until the account has bought the one-time unlock (or an admin granted it). Admins
always have access. The purchase is tied to the Card Trader **account**, so one payment
unlocks the app on Android and iPhone.

Payments go through **Google Play Billing** and **Apple In-App Purchase** — the stores
require this for unlocking app features and take their cut (15% at the small-business
rate; about $4.24 of $4.99 reaches you). **RevenueCat** sits in front of both stores:
it verifies receipts, handles "Restore purchases", and tells our server who paid.

## How it works

```
App ──buy──▶ Google Play / App Store ──receipt──▶ RevenueCat
 │                                                   │
 │  POST /billing/sync (after buying / restoring)    │ webhook (purchase, refund)
 ▼                                                   ▼
API ◀──── GET api.revenuecat.com/v1/subscribers/{publicId} ──── confirms the entitlement
 │
 └─ User.paidAt / paidVia  →  /users/me.hasFullAccess  →  app shows or hides the unlock screen
```

* The RevenueCat *app user id* is the user's `publicId`, so purchases follow the account.
* While the account isn't unlocked, every API route except its own profile, account
  security and billing answers **402 `PAYMENT_REQUIRED`** (`PurchaseGuard`); the app shows the
  unlock screen on that code.
* The server never trusts the app about a purchase: `POST /billing/sync` asks RevenueCat,
  and RevenueCat's webhook records purchases and refunds independently.
* `PAYWALL_ENABLED=false` (the default) switches the paywall off: everyone has full access.
  Keep it off until the products exist in both stores; the app then never shows the screen.

## Store setup (one time)

### 1. Accounts
* **Google Play Console** — https://play.google.com/console ($25 once). Also fill in
  *Payments profile* (bank details, tax) under Setup → Payments profile.
* **Apple Developer Program** — https://developer.apple.com/programs ($99/year). Then in
  App Store Connect → *Agreements, Tax, and Banking* accept the **Paid Apps** agreement and
  add bank/tax details — in-app purchases don't work until this is done.
* **RevenueCat** — https://app.revenuecat.com (free up to $2,500/month revenue). Create a
  project "Card Trader".

### 2. The product in each store
Same product id in both stores: **`card_trader_full_access`**, non-consumable / one-time, **$4.99**.

* **Google Play:** create the app (package `com.cardtrader.app`), upload a signed build to the
  *Internal testing* track (see "Signing" below), then *Monetize → Products → In-app products →
  Create*: id `card_trader_full_access`, name "Card Trader full access", price $4.99, **Activate**.
* **App Store Connect:** create the app (bundle id `com.cardtrader.app`), then
  *In-App Purchases → Create → Non-Consumable*: reference name "Full access", product id
  `card_trader_full_access`, price tier $4.99, add a localization (display name "Card Trader
  full access", description) and a review screenshot.

### 3. RevenueCat
1. *Project → Apps*: add **Play Store** (upload the service-account JSON Google asks for) and
   **App Store** (App-Specific Shared Secret / In-App Purchase key from App Store Connect).
2. *Products*: import `card_trader_full_access` from each store.
3. *Entitlements*: create **`full_access`** and attach both products.
4. *Offerings*: in the default offering add a package of type **Lifetime** with the product.
5. *API keys*: copy the **public** keys per platform (`goog_…`, `appl_…`) and the **secret** key (`sk_…`).
6. *Integrations → Webhooks*: URL `https://slabstorm.com/api/v1/billing/webhooks/revenuecat`,
   Authorization header value = a long random string (you choose it; it goes in
   `REVENUECAT_WEBHOOK_SECRET`). Send all events.

### 4. Configuration

API (`apps/api/.env` on the server):
```
PAYWALL_ENABLED=true
REVENUECAT_SECRET_KEY=sk_…
REVENUECAT_WEBHOOK_SECRET=<the value from step 3.6>
PURCHASE_ENTITLEMENT_ID=full_access
```
Restart the API afterwards (`Restart-Service CardTrader-API`).

Mobile (`apps/mobile/.env`, baked into the build):
```
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_…
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_…
```
These are public identifiers, not secrets. Rebuild the app after setting them.

### 5. Signing (Android)
Store builds must use your own upload key, not the debug key the local APK uses:
`keytool -genkeypair -v -keystore cardtrader-upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000`,
then reference it in `apps/mobile/android/app/build.gradle` (`signingConfigs.release`) or let
EAS manage it (`npx eas-cli build -p android`). Back the keystore up — losing it means you can
never update the Play listing.

## Testing purchases (no real money)
* **Android:** Play Console → *Setup → License testing*: add the Gmail addresses of testers.
  Install the app from the Internal testing link (not a sideloaded APK — Play Billing needs
  the Play-installed build). Purchases show as test transactions and aren't charged.
* **iOS:** App Store Connect → *Users and Access → Sandbox → Testers*: create a sandbox Apple
  ID; on the iPhone, Settings → App Store → Sandbox Account. Install a TestFlight or
  development build (purchases don't work in Expo Go).
* Watch the account unlock: RevenueCat → *Customers* → the user's publicId shows the
  entitlement; the admin console shows **Full access: Play Store / App Store**.

## Day to day
* **Admin console → user → Grant full access** unlocks an account without a purchase
  (testers, promotions, support). A store refund never removes an admin grant.
* **Refunds** issued in Play Console / App Store Connect reach RevenueCat, which calls the
  webhook; the account locks again automatically.
* **Switching the paywall off** for everyone: `PAYWALL_ENABLED=false` and restart the API.

## Where the code lives
| Part | Files |
|---|---|
| Access rule | `apps/api/src/common/auth/full-access.ts`, `purchase.guard.ts` (402 for locked accounts) |
| Server billing | `apps/api/src/modules/billing/` (status, sync, RevenueCat webhook) |
| Admin grant/revoke | `AdminUsersService.grantAccess/revokeAccess`, audit actions `ACCESS_GRANTED` / `ACCESS_REVOKED` |
| App | `apps/mobile/src/features/billing/` (store SDK wrapper, unlock screen), gating in `RootNavigator` |
| Tests | `apps/api/test/billing.e2e-spec.ts`, `apps/mobile/src/__tests__/paywall.test.tsx` |
