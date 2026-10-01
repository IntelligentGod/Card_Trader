# Card Trader — Architecture

Mobile app for collectors of Pokémon, One Piece and sports cards: track a
collection's market value and trade in person at card shows via QR codes.

## System

```
Mobile (Expo / React Native / TS)
  React Navigation · TanStack Query (server state) · Zustand (session, UI prefs)
  expo-secure-store (refresh token) · expo-camera (QR scan) · react-native-svg (charts, QR)
        │ HTTPS JSON  /api/v1  (Bearer JWT)
        ▼
API process (NestJS)                     Worker process (NestJS, same codebase)
  controllers → services → Prisma          @nestjs/schedule crons:
  guards · validation · error filter         • price refresh (every minute, leased batches)
  Swagger at /docs (non-production)          • daily snapshot (00:10 UTC)
        │                                          │  PriceProvider adapters (MOCK, EBAY)
        ▼                                          ▼
                     PostgreSQL (Prisma)
```

* **Two entrypoints, one codebase**: `src/main.ts` (HTTP) and `src/worker.ts`
  (jobs). Mobile requests never call a pricing provider; they read the DB.
* **Postgres is the MVP job queue**: the worker claims due `CardMarketValue`
  rows with `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)` and a
  lease (`lockedUntil`). Moving to BullMQ later only changes the scheduler.
* **Money is integer cents** everywhere (`Int` rows, `BigInt` aggregates).
* **Responses go through mappers** (`*.mapper.ts`); Prisma rows are never
  returned directly, so `passwordHash`, emails and internal user ids cannot leak.

## Repository layout

```
apps/api            NestJS API + worker, Prisma schema, migrations, seed, tests
  src/common        auth guard/decorators, error filter, pagination, utils
  src/modules       auth, users, uploads, cards, collection, portfolio, pricing, trades, reviews, health
  prisma/           schema.prisma, migrations/ (incl. raw SQL constraints), seed/
  test/             e2e tests against a real Postgres
apps/mobile         Expo app (src/features/<feature>/…, src/components, src/api, src/navigation)
packages/shared     enums, price-tier keys, deep links, money helpers, API contract types
```

## Data model (key points)

| Table | Purpose |
|---|---|
| `User` / `Profile` | identity vs public profile; `publicId` (12 random chars) is the only id shown to others |
| `RefreshToken` | SHA-256 of opaque token, rotation chain (`familyId`), reuse ⇒ family revoked |
| `CardSet` / `Card` | normalized global catalog; unique `(setId, cardNumber, variant)` |
| `CollectionItem` | a user's copy: condition, grading, purchase info, visibility, cached per-unit estimate |
| `CardPriceHistory` | one row per sold listing — never overwritten; unique `(sourceId, sourceReference)` |
| `CardMarketValue` | current estimate per card **and price tier**, plus refresh scheduling |
| `CardMarketValueDaily` | daily estimate series → charts and gainers/losers |
| `PortfolioSnapshot` | daily value per user per category → collection chart |
| `Trade` / `TradeParticipant` / `TradeItem` | two-sided trade; items are a frozen card+price snapshot |
| `Review` | unique `(tradeId, reviewerId)`; CHECK rating 1–5 and reviewer ≠ reviewed |

**Price tier** (`packages/shared/src/price-tier.ts`) decides comparability:
`RAW`, `RAW:NEAR_MINT`, `GRADED:PSA:10`, `GRADED:BGS:9.5`… Same card + same
tier = comparable. Raw is never compared with graded; grades/companies never
mix. The only fallback is raw-with-condition → generic `RAW`, at LOW confidence.

CHECK constraints and trigram search indexes are in
`prisma/migrations/20261001000100_constraints_and_search/migration.sql`.

## Pricing

* `PriceProvider` (`getRecentSales`) with `BasePriceProvider` implementing it as
  `searchSoldItems` → `normalizeSale`.
* `MockPriceProvider` — deterministic realistic sales for development.
* `EbayPriceProvider` — eBay **Marketplace Insights API** (limited release; needs
  eBay approval). The Finding API's `findCompletedItems` is decommissioned.
  Disabled unless `PRICING_PROVIDERS` includes `EBAY` and credentials exist.
* 130point: no authorized public API → no integration (no scraping).
* `listing-matcher.ts` scores title matches; low-confidence sales are stored
  but excluded (`isExcluded`) so they never skew estimates.
* `MarketValueService` + `MarketValueStrategy` (MVP: `MedianOfLastNStrategy(3, 180d)`).
  The algorithm id is stored on every estimate.

## Collection valuation

* Item value = per-unit estimate × quantity; unpriced items are counted, not valued.
* Headline changes (today / 7d / 30d) are **market movement on current
  holdings** — adding a card is not a "gain".
* Chart = `PortfolioSnapshot` history + a live "today" point.

## Trades

```
DRAFT ──propose(v)──▶ PROPOSED ──accept(v, other side)──▶ ACCEPTED ──both confirm──▶ COMPLETED
  ▲                      └──decline──▶ DECLINED
  └── any edit bumps version, resets acceptances, returns to DRAFT
DRAFT | PROPOSED | ACCEPTED ──cancel──▶ CANCELLED
```

* All totals and cash are computed server-side (`trade-calculator.ts`).
* Propose/accept must quote `expectedVersion` → stale terms get HTTP 409.
* Every mutation locks the trade row; accept/complete lock the source
  collection rows and re-check ownership and quantity.
* Completion requires **both** traders to confirm, then moves cards between
  collections (receiver gets a PRIVATE item, cost basis = trade value).
* Trade items keep their snapshot; history never depends on current prices.

## Security

argon2id · short-lived HS256 access JWT + rotating refresh tokens with reuse
detection · global JWT guard (opt-out via `@Public()`) · global throttling with
stricter auth/lookup limits · `ValidationPipe` whitelist + forbid unknown
fields · text sanitization · ownership in every query (404, not 403) · uploads
sniffed by magic bytes, keys generated server-side and ownership-checked ·
helmet · env validated at boot · Swagger disabled in production.

## Deliberate MVP limits

Local-disk media storage (single instance; an S3 driver fits `StorageService`),
polling instead of push for live trades, USD only, UTC calendar days, no admin
UI (unverified user-submitted cards are visible only to their submitter).
