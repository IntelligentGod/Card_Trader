import { CardCondition, CONDITION_LABELS, GRADING_COMPANIES, GradingCompany } from './enums';

/**
 * A price tier identifies which sales are comparable for a given card.
 * A raw card is never compared with a graded card, and graded cards are only
 * compared with the same company AND the same grade.
 *
 * Key format:
 *   RAW                    raw, condition unspecified
 *   RAW:NEAR_MINT          raw, specific condition
 *   GRADED:PSA:10          graded
 *   GRADED:BGS:9.5
 */
export type RawCondition = Exclude<CardCondition, 'GRADED'>;

export type PriceTier =
  | { kind: 'RAW'; condition: RawCondition }
  | { kind: 'GRADED'; company: GradingCompany; grade: number };

export const MIN_GRADE = 1;
export const MAX_GRADE = 10;

const RAW_CONDITIONS: readonly RawCondition[] = [
  'RAW',
  'MINT',
  'NEAR_MINT',
  'EXCELLENT',
  'VERY_GOOD',
  'GOOD',
  'PLAYED',
  'POOR',
];

export class InvalidPriceTierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPriceTierError';
  }
}

/** Grades are 1–10 in half-point steps (PSA 8.5, BGS 9.5, CGC 9.5 ...). */
export function isValidGrade(grade: number): boolean {
  return (
    Number.isFinite(grade) && grade >= MIN_GRADE && grade <= MAX_GRADE && Number.isInteger(grade * 2)
  );
}

export function formatGrade(grade: number): string {
  return Number.isInteger(grade) ? String(grade) : grade.toFixed(1);
}

export interface TierInput {
  condition: CardCondition;
  gradingCompany?: GradingCompany | null;
  grade?: number | string | null;
}

/** Builds a tier from collection-item style fields, enforcing graded/raw consistency. */
export function tierFromInput(input: TierInput): PriceTier {
  const hasCompany = input.gradingCompany !== null && input.gradingCompany !== undefined;
  const hasGrade = input.grade !== null && input.grade !== undefined && input.grade !== '';

  if (input.condition === 'GRADED') {
    if (!hasCompany || !hasGrade) {
      throw new InvalidPriceTierError('Graded cards require a grading company and a grade');
    }
    const grade = Number(input.grade);
    if (!isValidGrade(grade)) {
      throw new InvalidPriceTierError('Grade must be between 1 and 10 in steps of 0.5');
    }
    return { kind: 'GRADED', company: input.gradingCompany as GradingCompany, grade };
  }

  if (hasCompany || hasGrade) {
    throw new InvalidPriceTierError('Grading company and grade are only allowed when condition is GRADED');
  }
  return { kind: 'RAW', condition: input.condition };
}

export function tierKey(tier: PriceTier): string {
  if (tier.kind === 'GRADED') {
    return `GRADED:${tier.company}:${formatGrade(tier.grade)}`;
  }
  return tier.condition === 'RAW' ? 'RAW' : `RAW:${tier.condition}`;
}

export function parseTierKey(key: string): PriceTier | null {
  const parts = key.split(':');
  if (parts[0] === 'RAW') {
    if (parts.length === 1) return { kind: 'RAW', condition: 'RAW' };
    const condition = parts[1] as RawCondition;
    if (parts.length === 2 && condition !== 'RAW' && RAW_CONDITIONS.includes(condition)) {
      return { kind: 'RAW', condition };
    }
    return null;
  }
  if (parts[0] === 'GRADED' && parts.length === 3) {
    const company = parts[1] as GradingCompany;
    const gradeText = parts[2] ?? '';
    if (!/^\d{1,2}(\.5)?$/.test(gradeText)) return null;
    const grade = Number(gradeText);
    if (!GRADING_COMPANIES.includes(company) || !isValidGrade(grade)) return null;
    // Reject non-canonical forms like "10.0" by round-tripping.
    const tier: PriceTier = { kind: 'GRADED', company, grade };
    return tierKey(tier) === key ? tier : null;
  }
  return null;
}

/** Tier keys to try, in order, when the exact tier has no comparable sales. */
export function fallbackTierKeys(tier: PriceTier): string[] {
  // Raw cards with a specific condition may fall back to generic raw sales.
  // Graded cards never fall back: a PSA 9 is not a PSA 10.
  if (tier.kind === 'RAW' && tier.condition !== 'RAW') return ['RAW'];
  return [];
}

export function tierLabel(tier: PriceTier): string {
  if (tier.kind === 'GRADED') return `${tier.company} ${formatGrade(tier.grade)}`;
  return tier.condition === 'RAW' ? 'Raw' : `Raw · ${CONDITION_LABELS[tier.condition]}`;
}

export function tierLabelFromKey(key: string): string {
  const tier = parseTierKey(key);
  return tier ? tierLabel(tier) : key;
}
