import { buildUserDeepLink, parseUserDeepLink } from './deep-link';
import { formatCents, formatSignedCents, parseDollarsToCents, percentChange } from './money';

describe('deep links', () => {
  it('builds and parses user links', () => {
    const link = buildUserDeepLink('abcDEF123_-x');
    expect(link).toBe('cardtrader://u/abcDEF123_-x');
    expect(parseUserDeepLink(link)).toBe('abcDEF123_-x');
  });

  it('rejects anything that is not exactly our format', () => {
    for (const raw of [
      'https://evil.example/u/abcDEF123_-x',
      'cardtrader://u/short',
      'cardtrader://u/abcDEF123_-x/extra',
      'cardtrader://trade/abcDEF123_-x',
      'cardtrader://u/abc DEF123',
      '',
    ]) {
      expect(parseUserDeepLink(raw)).toBeNull();
    }
  });
});

describe('money', () => {
  it('formats cents', () => {
    expect(formatCents(22000)).toBe('$220');
    expect(formatCents(842000)).toBe('$8,420');
    expect(formatCents(1999)).toBe('$19.99');
    expect(formatSignedCents(12000)).toBe('+$120');
    expect(formatSignedCents(-2000)).toBe('-$20');
  });

  it('parses dollar input safely', () => {
    expect(parseDollarsToCents('20')).toBe(2000);
    expect(parseDollarsToCents('$1,200.5')).toBe(120050);
    expect(parseDollarsToCents('0.07')).toBe(7);
    expect(parseDollarsToCents('1.234')).toBeNull();
    expect(parseDollarsToCents('-5')).toBeNull();
    expect(parseDollarsToCents('abc')).toBeNull();
  });

  it('computes percent change', () => {
    expect(percentChange(110, 100)).toBeCloseTo(10);
    expect(percentChange(100, 0)).toBeNull();
  });
});
