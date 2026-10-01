import { detectTier, isExcludedListing, matchConfidence } from './listing-matcher';
import type { PricingTarget } from './price-provider.interface';

const target: PricingTarget = {
  cardId: 'c1',
  category: 'POKEMON',
  name: 'Pikachu',
  setName: 'Scarlet & Violet—151',
  setCode: 'SV3PT5',
  year: 2023,
  cardNumber: '173',
  variant: '',
  subject: 'Pikachu',
  rarity: 'Illustration Rare',
  tier: { kind: 'GRADED', company: 'PSA', grade: 10 },
  tierKey: 'GRADED:PSA:10',
};

describe('listing matcher', () => {
  it('detects grading company and grade', () => {
    expect(detectTier('Pikachu 173/165 151 PSA 10 GEM MINT')).toEqual({ kind: 'GRADED', company: 'PSA', grade: 10 });
    expect(detectTier('Charizard Beckett 9.5 Base Set')).toEqual({ kind: 'GRADED', company: 'BGS', grade: 9.5 });
    expect(detectTier('Luffy OP05-119 CGC Pristine 10')).toEqual({ kind: 'GRADED', company: 'CGC', grade: 10 });
    expect(detectTier('Zoro OP01-025 SGC 9')).toEqual({ kind: 'GRADED', company: 'OTHER', grade: 9 });
  });

  it('detects raw condition, defaulting to generic raw', () => {
    expect(detectTier('Pikachu 173/165 Near Mint')).toEqual({ kind: 'RAW', condition: 'NEAR_MINT' });
    expect(detectTier('Pikachu 173/165 LP')).toEqual({ kind: 'RAW', condition: 'EXCELLENT' });
    expect(detectTier('Charizard ex 199/165 Near Mint')).toEqual({ kind: 'RAW', condition: 'NEAR_MINT' });
    expect(detectTier('Luffy OP01-120 very good')).toEqual({ kind: 'RAW', condition: 'VERY_GOOD' });
    expect(detectTier('Mahomes rookie mint')).toEqual({ kind: 'RAW', condition: 'MINT' });
    expect(detectTier('Pikachu 173/165 151')).toEqual({ kind: 'RAW', condition: 'RAW' });
  });

  it('excludes lots, sealed product and fakes', () => {
    expect(isExcludedListing('Pokemon card lot 50 cards')).toBe(true);
    expect(isExcludedListing('151 Booster Box sealed')).toBe(true);
    expect(isExcludedListing('Pikachu custom proxy card')).toBe(true);
    expect(isExcludedListing('Pikachu 173/165 PSA 10')).toBe(false);
  });

  it('scores exact matches high and wrong card numbers low', () => {
    expect(matchConfidence('Pikachu 173/165 Scarlet Violet 151 PSA 10', target)).toBeGreaterThanOrEqual(0.9);
    expect(matchConfidence('Pikachu 025/165 151 PSA 10', target)).toBeLessThanOrEqual(0.5);
    expect(matchConfidence('Charmander 173/165 PSA 10', target)).toBeLessThan(0.7);
  });

  it('requires the variant when the card has one', () => {
    const alt = { ...target, variant: 'Alternate Art' };
    expect(matchConfidence('Pikachu 173/165 151 PSA 10', alt)).toBeLessThanOrEqual(0.5);
    expect(matchConfidence('Pikachu 173/165 151 Alternate Art PSA 10', alt)).toBeGreaterThanOrEqual(0.9);
  });
});
