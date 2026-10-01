import type { GradingCompany, PriceTier, RawCondition } from '@card-trader/shared';
import type { PricingTarget } from './price-provider.interface';

/**
 * Title heuristics shared by marketplace providers whose data is free-text
 * listings. Conservative by design: when unsure, confidence goes down and the
 * sale is stored as excluded rather than skewing the estimate.
 */

const EXCLUDE_PATTERN =
  /\b(lot|lots|bundle|proxy|reprint|custom|orica|digital|code card|online code|empty|sealed|booster|pack|packs|box|case|bulk|you pick|choose|pick your|set of|playset|x\d+|\d+x)\b/i;

const GRADE_PATTERN =
  /\b(PSA|BGS|BECKETT|CGC|SGC|TAG|ACE)\b[\s-]*(?:GEM[\s-]*MINT[\s-]*|GEM[\s-]*MT[\s-]*|MINT[\s-]*|PRISTINE[\s-]*|BLACK[\s-]*LABEL[\s-]*|NM-MT[\s-]*)?(10|[1-9](?:\.5)?)\b/i;

const COMPANY_MAP: Record<string, GradingCompany> = {
  PSA: 'PSA',
  BGS: 'BGS',
  BECKETT: 'BGS',
  CGC: 'CGC',
  SGC: 'OTHER',
  TAG: 'OTHER',
  ACE: 'OTHER',
};

// First match wins, so more specific phrases come first ("very good" before
// "good", "near mint" before "mint"). "EX" is not used: it is a Pokémon card type.
const RAW_CONDITION_PATTERNS: Array<[RegExp, RawCondition]> = [
  [/\b(damaged|dmg|creased|poor)\b/i, 'POOR'],
  [/\b(heavily played|hp)\b/i, 'PLAYED'],
  [/\b(very good|vg)\b/i, 'VERY_GOOD'],
  [/\b(moderately played|mp|good)\b/i, 'GOOD'],
  [/\b(lightly played|lp|excellent|exc)\b/i, 'EXCELLENT'],
  [/\b(near mint|nm|nm\/m|nm-m)\b/i, 'NEAR_MINT'],
  [/\bmint\b/i, 'MINT'],
];

export function isExcludedListing(title: string): boolean {
  return EXCLUDE_PATTERN.test(title);
}

export function detectTier(title: string): PriceTier {
  const graded = GRADE_PATTERN.exec(title);
  if (graded?.[1] && graded[2]) {
    const company = COMPANY_MAP[graded[1].toUpperCase()] ?? 'OTHER';
    return { kind: 'GRADED', company, grade: Number(graded[2]) };
  }
  for (const [pattern, condition] of RAW_CONDITION_PATTERNS) {
    if (pattern.test(title)) return { kind: 'RAW', condition };
  }
  return { kind: 'RAW', condition: 'RAW' };
}

function normalizeNumber(value: string): string {
  return value.replace(/^#/, '').split('/')[0]!.replace(/^0+(?=\d)/, '').toLowerCase();
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

/** 0..1 score of how likely `title` describes exactly `target` (card identity only, not tier). */
export function matchConfidence(title: string, target: PricingTarget): number {
  const titleTokens = new Set(tokens(title));
  const titleNumbers = new Set(
    (title.match(/#?\b[A-Za-z]{0,4}\d{1,4}[A-Za-z]?(?:\/\d{1,4})?\b/g) ?? []).map(normalizeNumber),
  );

  const numberMatch = titleNumbers.has(normalizeNumber(target.cardNumber));
  const nameTokens = tokens(target.subject ?? target.name);
  const nameHits = nameTokens.filter((t) => titleTokens.has(t)).length;
  const nameScore = nameTokens.length ? nameHits / nameTokens.length : 0;
  const setTokens = tokens(`${target.setName} ${target.setCode}`);
  const setScore = setTokens.some((t) => titleTokens.has(t)) ? 1 : 0;
  const variantTokens = tokens(target.variant);
  const variantOk = variantTokens.length === 0 || variantTokens.every((t) => titleTokens.has(t));

  let score = (numberMatch ? 0.4 : 0) + nameScore * 0.4 + setScore * 0.2;
  if (!numberMatch) score = Math.min(score, 0.5);
  if (!variantOk) score = Math.min(score, 0.5);
  return Math.round(score * 100) / 100;
}
