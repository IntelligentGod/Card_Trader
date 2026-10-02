/**
 * Loads only the starter card catalog (SEED_SETS) — no demo users, collections, events or mock sales.
 * Safe for production and safe to re-run (upserts by set code / card number + variant).
 *
 *   npm run db:catalog -w @card-trader/api
 */
import { PrismaClient } from '@prisma/client';
import { SEED_SETS } from './catalog';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    let cards = 0;
    for (const set of SEED_SETS) {
      const row = await prisma.cardSet.upsert({
        where: { category_code: { category: set.category, code: set.code } },
        create: { category: set.category, code: set.code, name: set.name, year: set.year, manufacturer: set.manufacturer },
        update: { name: set.name, year: set.year, manufacturer: set.manufacturer },
      });
      for (const card of set.cards) {
        const variant = card.variant ?? '';
        await prisma.card.upsert({
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
        cards++;
      }
    }
    console.log(`Catalog: ${cards} cards in ${SEED_SETS.length} sets`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
