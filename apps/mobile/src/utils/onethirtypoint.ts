import { parseTierKey, tierLabel, type CardSummary } from '@card-trader/shared';

type SearchCard = Pick<CardSummary, 'name' | 'subject' | 'cardNumber' | 'variant'> & { set: { name: string; year: number | null } };

/**
 * The words to search 130point's sold listings with, e.g. "2023 Topps Chrome Shohei Ohtani #17 Refractor PSA 10".
 * Raw copies get no condition words: sold listings rarely state a raw condition.
 */
export function oneThirtyPointQuery(card: SearchCard, tierKey: string): string {
  const tier = parseTierKey(tierKey);
  const year = card.set.year && !card.set.name.includes(String(card.set.year)) ? String(card.set.year) : null;
  return [year, card.set.name, card.subject ?? card.name, `#${card.cardNumber}`, card.variant || null, tier?.kind === 'GRADED' ? tierLabel(tier) : null]
    .filter(Boolean)
    .join(' ');
}

/** 130point has no API: the app only links to its public sold-listings search. */
export function oneThirtyPointUrl(query: string): string {
  return `https://130point.com/sales/?search=${encodeURIComponent(query)}`;
}
