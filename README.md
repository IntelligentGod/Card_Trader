# Card Trader

Make physical card shows digitally searchable. Collectors and vendors keep one
inventory (raw or graded, For Trade / For Sale), get automatic comps, find
cards across every vendor at a show, trade by QR code with server-calculated
values and cash, negotiate with counteroffers, confirm the swap, and review
each other.

Main navigation: **Discover | Inventory | Trade | Events | Profile**.

* **API** — NestJS + Prisma + PostgreSQL (`apps/api`)
* **Mobile** — Expo / React Native (`apps/mobile`)
* **Admin website** — Vite + React, read-only admin console (`apps/admin`)
* **Shared** — types, enums and domain helpers (`packages/shared`)

Architecture and design decisions: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Requirements

* Node.js 20+ (tested with Node 24) and npm 10+
* A PostgreSQL 16+ database — **either**:
  * no Docker needed: `npm run db:start` runs a real embedded Postgres, **or**
  * Docker: `docker compose up -d db`
* For the phone: the **Expo Go** app, or an Android emulator / iOS simulator.

## First-time setup

```bash
npm install                         # installs all workspaces, builds packages/shared, generates Prisma client

# API config (a ready-to-use apps/api/.env is created for local dev; otherwise:)
cp apps/api/.env.example apps/api/.env   # then set JWT_ACCESS_SECRET

# Terminal 1 — database (skip if using Docker; then set DATABASE_URL port to 5432)
npm run db:start

# Terminal 2 — schema + demo data (catalog, 2 users, a year of mock prices)
npm run db:setup
```

Demo accounts (password `CardShow2025!`):

| Email | Role |
|---|---|
| `tom@example.com` | Collector — Pokémon, a couple of One Piece and sports cards; "Interested" in the Austin show |
| `alex@example.com` | Vendor Mode ("Grand Line Cards"), approved at the Austin Card Show, table 14 |
| `sam@example.com` | Event organizer of the Austin Card Show and the Dallas Collectors Expo |
| `admin@example.com` | Admin — opens the admin console (mobile Profile tab and the admin website) |

## Running

```bash
npm run api:dev        # API on http://localhost:3000/api/v1, Swagger at http://localhost:3000/docs
npm run worker:dev     # pricing worker (refreshes prices, nightly snapshots)
npm run mobile         # Expo dev server; press a (Android) or scan the QR with Expo Go
```

On a physical phone the app talks to the API on the same machine as the Expo
dev server automatically (same Wi-Fi). To point elsewhere set
`EXPO_PUBLIC_API_URL` (see `apps/mobile/.env.example`). Also set
`PUBLIC_BASE_URL` in `apps/api/.env` to your computer's LAN address so
uploaded images load on the phone.

## Admin console

Admins can look up every account, collection (including personal cards),
trade, review and event, and:

* **edit users** — email, username, display name, bio, location, social links,
  remove a profile photo, and edit vendor details;
* **block / unblock, reset passwords** — blocking or a password reset locks
  the account out on its very next request and signs it out on every device;
  the super admin also changes roles and manages admins, and normal admins
  never see the super admin. Nobody can change their own role or status;
* **browse the card catalog** — every card including unverified user
  submissions, who submitted it, owners, copies and market values; **verify**
  submissions and correct card details;
* **see analytics** — pie charts (collection value by category, listing
  status, trades by status, catalog by category/source, graders) and monthly
  bar charts (signups, completed trades and their value). A pie only appears
  when at least 3 parts are non-zero; otherwise the numbers are shown.

Every change is written to an audit log (who, when, why, each field's before
and after), shown as **History** on the user or card.

* **Mobile:** sign in as an admin → **Profile → Admin console**.
* **Web:** `npm run admin:dev`, then open http://localhost:5173 and sign in
  with an admin account. The API must allow the site's origin:
  `CORS_ORIGINS=http://localhost:5173` in `apps/api/.env` (comma-separated
  for more). To point the site at another API, set `VITE_API_URL` in
  `apps/admin/.env` (see `apps/admin/.env.example`).

Sign-in (Google, Apple, email + 2FA), roles
(USER / ADMIN / SUPER_ADMIN), blocking, password resets and the audit log are
described in [docs/AUTH_AND_ADMIN.md](docs/AUTH_AND_ADMIN.md), including the
super-admin bootstrap and the Google/Apple setup.

The super admin manages admins in the app; roles can also be set from the command line:

```bash
npm run admin:grant -w @card-trader/api -- someone@example.com
npm run admin:revoke -w @card-trader/api -- someone@example.com
npm run admin:list -w @card-trader/api
```

The role is checked against the database on every admin request, so granting
or revoking takes effect immediately, without signing in again.

## Android build (APK / Android Studio)

```bash
npm run build:android                                          # APK for the emulator (API at 10.0.2.2)
npm run build:android -- -ApiUrl http://192.168.1.20:3000/api/v1   # APK for a real phone on your Wi-Fi
```

The APK lands in `build-output/CardTrader-release.apk`; install it with
`adb install -r build-output\CardTrader-release.apk`. It is a standalone
build (no Expo Go, no dev server) — only the API needs to be running.

To work in **Android Studio**, open `apps/mobile/android` through a short
drive letter (`subst X: "<repo path>"`, then open `X:\apps\mobile\android`):
the C++ build fails on Windows' 260-character path limit when the repo is in
a long folder. Set *Settings → Build Tools → Gradle → Gradle JDK* to Java 17.
Debug builds load JavaScript from Metro, so run `npm run mobile` alongside.

## Tests

```bash
npm test               # unit tests: shared, API (calculator, state machine, pricing), mobile (RNTL)
npm run test:e2e       # API end-to-end against the cardtrader_test database (db:start must be running)
npm run typecheck      # strict TypeScript across all workspaces
```

## Manual test script (two phones or phone + emulator)

1. Sign in as Tom on device A and Alex on device B.
2. **Discover** shows upcoming card shows, collection value, movement, a chart,
   most valuable cards, open trades, a scan button and the notification bell.
3. **Inventory → +**: pick *Graded*, PSA 10 with a cert number, or *Raw* with a
   condition (Mint … Poor). Set the status (*Personal / For trade / For sale /
   Trade + sale*) and an optional asking price; add front and back photos.
   The worker prices it within a minute (last 3 comps + estimate + chart).
4. **Events → Austin Card Show → Search this event** (as Tom): filter by card,
   set, year, raw/graded, grader, grade, condition, price, for sale / for trade.
   Each result shows the price, the vendor and the table number.
5. Open a result → **Start trade for this card** (linked to the show). Or scan
   Alex's QR (**My QR** on B, **Scan QR** on A) to browse all their cards.
6. In the trade builder add cards on both sides; totals, difference and the
   suggested cash are calculated by the server. **Adjust cash** for an amount.
7. Tom taps **Send offer**. Alex gets a notification, opens the offer and can
   **Accept**, **Decline**, **Counter** (edit and send back) or cancel.
   Any change — even after acceptance — resets both acceptances.
8. After both accept and swap the cards, both tap **Confirm received**. The trade
   completes and the cards move between inventories.
9. Both leave a 1–5 star review, shown as **Verified Trade** on the profiles.

Organizer / vendor flow: sign in as Sam → **Events → +** to create a draft and
**Publish**. Sign in as Tom → **Profile → Vendor Mode → Set up**, then open the
event → **Join as Vendor**. As Sam → the event → **Vendor applications** →
enter a table number → **Approve**. As Tom → the event → **Choose cards to
bring** (only cards For Trade / For Sale qualify).

Notifications (trade offers, counteroffers, completed trades, reviews, vendor
applications and decisions, event updates, and a 24-hour reminder sent by the
worker) are in-app: the bell on Discover polls every 30 s. Phone push
notifications would need `expo-notifications` and a development build.

## Pricing providers

`PRICING_PROVIDERS=MOCK` (default) generates realistic, deterministic sales.
`EBAY` uses eBay's Marketplace Insights API, which requires an approved eBay
developer application (`EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`). 130point has no
authorized public API and is intentionally not integrated.

## Project scripts

| Script | What it does |
|---|---|
| `npm run db:start` | embedded PostgreSQL on port 5433 (data under `%LOCALAPPDATA%/card-trader`) |
| `npm run db:setup` | apply migrations + seed |
| `npm run api:dev` / `worker:dev` | API / worker with reload |
| `npm run mobile` | Expo dev server |
| `npm test` / `test:e2e` / `typecheck` | quality gates (also run in CI) |

## Production notes

* Build the image with `docker build -f apps/api/Dockerfile .`; run it once as
  the API (`node dist/main.js`) and once as the worker (`node dist/worker.js`).
* Run `npx prisma migrate deploy` on release.
* Use a strong `JWT_ACCESS_SECRET`, `NODE_ENV=production` (disables Swagger),
  `TRUST_PROXY=1` behind a load balancer, and a persistent volume for uploads.
* Mobile builds: `npx eas-cli build` (camera, secure store and image picker are
  configured in `apps/mobile/app.json`).
