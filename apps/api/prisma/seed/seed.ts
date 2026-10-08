/**
 * Development seed: catalog, demo collectors (one in Vendor Mode), an event
 * organizer with upcoming card shows, and a year of mock price history
 * produced by the REAL pricing pipeline (mock provider → sales →
 * MarketValueService → daily series), so every screen has data.
 *
 * Re-running is safe: existing demo users keep their cards (only profile and
 * vendor details are refreshed) and existing events are left alone.
 *
 *   npm run db:setup   (migrate + seed)
 */
import 'reflect-metadata';
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { tierFromInput, tierKey } from '@card-trader/shared';
import { generatePublicId } from '../../src/common/utils/ids';
import { AppConfigModule } from '../../src/config/config.module';
import { PasswordService } from '../../src/modules/auth/password.service';
import { DailySnapshotService } from '../../src/modules/pricing/jobs/daily-snapshot.service';
import { PriceRefreshService } from '../../src/modules/pricing/jobs/price-refresh.service';
import { PricingModule } from '../../src/modules/pricing/pricing.module';
import { MockPriceProvider } from '../../src/modules/pricing/providers/mock/mock-price.provider';
import { PRICE_PROVIDERS } from '../../src/modules/pricing/providers/price-provider.interface';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SEED_EVENTS, SEED_PASSWORD, SEED_SETS, SEED_USERS } from './catalog';

@Module({
  imports: [AppConfigModule, PrismaModule, PricingModule],
  providers: [
    MockPriceProvider,
    { provide: PRICE_PROVIDERS, inject: [MockPriceProvider], useFactory: (mock: MockPriceProvider) => [mock] },
    PriceRefreshService,
    DailySnapshotService,
  ],
})
class SeedModule {}

const logger = new Logger('Seed');

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed a production database');

  const app = await NestFactory.createApplicationContext(SeedModule, { logger: ['error', 'warn', 'log'] });
  const prisma = app.get(PrismaService);
  const refresh = app.get(PriceRefreshService);
  const snapshots = app.get(DailySnapshotService);

  // 1. Catalog
  const cardIdByRef = new Map<string, string>();
  for (const set of SEED_SETS) {
    const row = await prisma.cardSet.upsert({
      where: { category_code: { category: set.category, code: set.code } },
      create: { category: set.category, code: set.code, name: set.name, year: set.year, manufacturer: set.manufacturer },
      update: { name: set.name, year: set.year, manufacturer: set.manufacturer },
    });
    for (const card of set.cards) {
      const variant = card.variant ?? '';
      const saved = await prisma.card.upsert({
        where: { setId_cardNumber_variant: { setId: row.id, cardNumber: card.cardNumber, variant } },
        create: {
          setId: row.id,
          category: set.category,
          name: card.name,
          cardNumber: card.cardNumber,
          variant,
          subject: card.subject ?? null,
          rarity: card.rarity ?? null,
          source: 'SEED',
          externalRef: card.ref,
        },
        update: { name: card.name, subject: card.subject ?? null, rarity: card.rarity ?? null, externalRef: card.ref },
      });
      cardIdByRef.set(card.ref, saved.id);
    }
  }
  logger.log(`Catalog: ${cardIdByRef.size} cards in ${SEED_SETS.length} sets`);

  // 2. Demo users + collections (cards are created once; re-running keeps them)
  const passwords = new PasswordService();
  const passwordHash = await passwords.hash(SEED_PASSWORD);
  const userIdByEmail = new Map<string, string>();
  for (const seedUser of SEED_USERS) {
    const profileFields = {
      username: seedUser.username,
      location: seedUser.location,
      socialLinks: seedUser.socialLinks,
    };
    const vendorFields = seedUser.vendor && {
      isActive: true,
      businessName: seedUser.vendor.businessName,
      description: seedUser.vendor.description,
      website: seedUser.vendor.website ?? null,
      socialLinks: seedUser.vendor.socialLinks,
    };
    const existing = await prisma.user.findUnique({ where: { email: seedUser.email } });
    if (existing) {
      userIdByEmail.set(seedUser.email, existing.id);
      await prisma.profile.update({ where: { userId: existing.id }, data: profileFields });
      if (seedUser.role && existing.role !== seedUser.role) {
        await prisma.user.update({ where: { id: existing.id }, data: { role: seedUser.role } });
      }
      if (vendorFields) {
        await prisma.vendorProfile.upsert({
          where: { userId: existing.id },
          create: { userId: existing.id, ...vendorFields },
          update: vendorFields,
        });
      }
      continue;
    }
    const user = await prisma.user.create({
      data: {
        email: seedUser.email,
        passwordHash,
        publicId: generatePublicId(),
        role: seedUser.role ?? 'USER',
        // Demo addresses can't receive mail; treat them as verified. Demo accounts are unlocked.
        emailVerifiedAt: new Date(),
        paidAt: new Date(),
        paidVia: 'SEED',
        profile: { create: { displayName: seedUser.displayName, bio: seedUser.bio, ...profileFields } },
        ...(vendorFields && { vendorProfile: { create: vendorFields } }),
      },
    });
    userIdByEmail.set(seedUser.email, user.id);
    await prisma.userAuthProvider.create({
      data: { userId: user.id, provider: 'PASSWORD', providerUserId: user.id, providerEmail: seedUser.email },
    });
    for (const item of seedUser.items) {
      const cardId = cardIdByRef.get(item.ref);
      if (!cardId) throw new Error(`Unknown seed card ${item.ref}`);
      const tier = tierFromInput({ condition: item.condition, gradingCompany: item.gradingCompany, grade: item.grade });
      await prisma.collectionItem.create({
        data: {
          userId: user.id,
          cardId,
          quantity: item.quantity ?? 1,
          condition: item.condition,
          gradingCompany: item.gradingCompany ?? null,
          grade: item.grade === undefined ? null : new Prisma.Decimal(item.grade),
          certNumber: item.certNumber ?? null,
          priceTierKey: tierKey(tier),
          purchasePriceCents: item.purchasePriceCents ?? null,
          listingStatus: item.listingStatus,
          askingPriceCents: item.askingPriceCents ?? null,
        },
      });
    }
    logger.log(`User ${seedUser.email} (public id ${user.publicId}) with ${seedUser.items.length} items`);
  }

  // 3. Track every collected tier + raw for every catalog card, then price them now.
  const collected = await prisma.collectionItem.findMany({ select: { cardId: true, priceTierKey: true }, distinct: ['cardId', 'priceTierKey'] });
  const targets = new Map<string, { cardId: string; priceTierKey: string }>();
  for (const row of collected) targets.set(`${row.cardId}|${row.priceTierKey}`, row);
  for (const cardId of cardIdByRef.values()) targets.set(`${cardId}|RAW`, { cardId, priceTierKey: 'RAW' });

  let priced = 0;
  for (const target of targets.values()) {
    const row = await prisma.cardMarketValue.upsert({
      where: { cardId_priceTierKey: { cardId: target.cardId, priceTierKey: target.priceTierKey } },
      create: { cardId: target.cardId, priceTierKey: target.priceTierKey },
      update: {},
    });
    if (row.computedAt) continue;
    await refresh.refreshOne({ id: row.id, cardId: row.cardId, priceTierKey: row.priceTierKey });
    priced++;
  }
  logger.log(`Priced ${priced} card tiers with a year of mock sales`);

  // 4. Approximate a year of portfolio history from the daily series (seed-only shortcut).
  await prisma.$executeRaw`
    INSERT INTO "PortfolioSnapshot" ("userId", "date", "category", "valueCents", "cardCount")
    SELECT ci."userId", d."date", c."category", SUM(ci."quantity"::bigint * d."valueCents"), SUM(ci."quantity")::int
    FROM "CollectionItem" ci
    JOIN "Card" c ON c.id = ci."cardId"
    JOIN "CardMarketValueDaily" d ON d."cardId" = ci."cardId" AND d."priceTierKey" = ci."priceTierKey"
    WHERE d."date" < CURRENT_DATE
    GROUP BY ci."userId", d."date", c."category"
    ON CONFLICT ("userId", "date", "category")
    DO UPDATE SET "valueCents" = EXCLUDED."valueCents", "cardCount" = EXCLUDED."cardCount"`;
  await snapshots.run();

  // 5. Card shows: published events, approved vendors with tables, event inventory.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (const seedEvent of SEED_EVENTS) {
    const organizerId = userIdByEmail.get(seedEvent.organizerEmail);
    if (!organizerId) throw new Error(`Unknown organizer ${seedEvent.organizerEmail}`);
    const existing = await prisma.event.findFirst({ where: { title: seedEvent.title, organizerId } });
    if (existing) continue;

    const startsAt = new Date(today.getTime() + (seedEvent.startsInDays * 24 + seedEvent.startHourUtc) * 3_600_000);
    const event = await prisma.event.create({
      data: {
        organizerId,
        title: seedEvent.title,
        description: seedEvent.description,
        startsAt,
        endsAt: new Date(startsAt.getTime() + seedEvent.durationHours * 3_600_000),
        venueName: seedEvent.venueName,
        address: seedEvent.address,
        city: seedEvent.city,
        region: seedEvent.region,
        admission: seedEvent.admission,
        organizerName: seedEvent.organizerName,
        website: seedEvent.website,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    for (const [email, tableNumber] of Object.entries(seedEvent.vendors)) {
      const vendorId = userIdByEmail.get(email);
      if (!vendorId) throw new Error(`Unknown vendor ${email}`);
      const application = await prisma.eventVendor.create({
        data: { eventId: event.id, vendorId, status: 'APPROVED', tableNumber, decidedAt: new Date() },
      });
      const listed = await prisma.collectionItem.findMany({
        where: { userId: vendorId, listingStatus: { not: 'PERSONAL' } },
        select: { id: true },
      });
      await prisma.eventInventoryItem.createMany({
        data: listed.map((item) => ({ eventVendorId: application.id, collectionItemId: item.id })),
      });
    }
    for (const email of seedEvent.savedBy) {
      const userId = userIdByEmail.get(email);
      if (userId) await prisma.eventSave.create({ data: { userId, eventId: event.id } });
    }
    logger.log(`Event "${seedEvent.title}" with ${Object.keys(seedEvent.vendors).length} vendor(s)`);
  }

  logger.log(`Done. Sign in as ${SEED_USERS.map((u) => u.email).join(' or ')} with password ${SEED_PASSWORD}`);
  await app.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
