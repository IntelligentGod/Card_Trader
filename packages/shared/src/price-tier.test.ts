import {
  fallbackTierKeys,
  InvalidPriceTierError,
  parseTierKey,
  tierFromInput,
  tierKey,
  tierLabel,
} from './price-tier';

describe('price tiers', () => {
  it('builds canonical keys', () => {
    expect(tierKey(tierFromInput({ condition: 'RAW' }))).toBe('RAW');
    expect(tierKey(tierFromInput({ condition: 'NEAR_MINT' }))).toBe('RAW:NEAR_MINT');
    expect(tierKey(tierFromInput({ condition: 'GRADED', gradingCompany: 'PSA', grade: 10 }))).toBe('GRADED:PSA:10');
    expect(tierKey(tierFromInput({ condition: 'GRADED', gradingCompany: 'BGS', grade: '9.5' }))).toBe('GRADED:BGS:9.5');
  });

  it('rejects inconsistent graded/raw input', () => {
    expect(() => tierFromInput({ condition: 'GRADED', gradingCompany: 'PSA' })).toThrow(InvalidPriceTierError);
    expect(() => tierFromInput({ condition: 'NEAR_MINT', gradingCompany: 'PSA', grade: 9 })).toThrow(InvalidPriceTierError);
    expect(() => tierFromInput({ condition: 'GRADED', gradingCompany: 'PSA', grade: 9.3 })).toThrow(InvalidPriceTierError);
    expect(() => tierFromInput({ condition: 'GRADED', gradingCompany: 'PSA', grade: 11 })).toThrow(InvalidPriceTierError);
  });

  it('round-trips keys and rejects non-canonical ones', () => {
    for (const key of ['RAW', 'RAW:POOR', 'GRADED:CGC:9.5', 'GRADED:PSA:1']) {
      const tier = parseTierKey(key);
      expect(tier).not.toBeNull();
      expect(tierKey(tier!)).toBe(key);
    }
    for (const key of ['RAW:RAW', 'RAW:GRADED', 'GRADED:PSA:10.0', 'GRADED:XYZ:10', 'GRADED:PSA', 'foo']) {
      expect(parseTierKey(key)).toBeNull();
    }
  });

  it('never falls back across raw/graded or between grades', () => {
    expect(fallbackTierKeys({ kind: 'RAW', condition: 'NEAR_MINT' })).toEqual(['RAW']);
    expect(fallbackTierKeys({ kind: 'RAW', condition: 'RAW' })).toEqual([]);
    expect(fallbackTierKeys({ kind: 'GRADED', company: 'PSA', grade: 10 })).toEqual([]);
  });

  it('labels tiers for display', () => {
    expect(tierLabel({ kind: 'GRADED', company: 'PSA', grade: 10 })).toBe('PSA 10');
    expect(tierLabel({ kind: 'RAW', condition: 'EXCELLENT' })).toBe('Raw · Excellent');
  });
});
