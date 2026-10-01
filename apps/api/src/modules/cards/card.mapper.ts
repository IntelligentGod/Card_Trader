import type { Card, CardSet } from '@prisma/client';
import type { CardSetSummary, CardSummary } from '@card-trader/shared';

export type CardWithSet = Card & { set: CardSet };

export const cardWithSetInclude = { set: true } as const;

export function toCardSetSummary(set: CardSet): CardSetSummary {
  return {
    id: set.id,
    category: set.category,
    code: set.code,
    name: set.name,
    year: set.year,
    manufacturer: set.manufacturer,
  };
}

export function toCardSummary(card: CardWithSet): CardSummary {
  return {
    id: card.id,
    category: card.category,
    name: card.name,
    cardNumber: card.cardNumber,
    variant: card.variant,
    subject: card.subject,
    rarity: card.rarity,
    imageUrl: card.imageUrl,
    isVerified: card.isVerified,
    set: toCardSetSummary(card.set),
  };
}
