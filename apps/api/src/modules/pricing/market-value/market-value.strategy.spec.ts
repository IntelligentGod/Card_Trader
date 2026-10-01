import { DAY_MS } from '../../../common/utils/dates';
import { median, MedianOfLastNStrategy } from './market-value.strategy';

const now = new Date('2026-09-30T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS);
const sale = (dollars: number, days: number) => ({ priceCents: dollars * 100, soldAt: daysAgo(days) });

describe('median', () => {
  it('handles odd and even counts', () => {
    expect(median([220, 210, 215])).toBe(215);
    expect(median([100, 201])).toBe(151);
  });
});

describe('MedianOfLastNStrategy', () => {
  const strategy = new MedianOfLastNStrategy(3, 180);

  it('matches the spec example: $220, $210, $215 → $215 (HIGH)', () => {
    const estimate = strategy.estimate([sale(220, 2), sale(210, 5), sale(215, 8)], now);
    expect(estimate).toEqual({ valueCents: 21500, confidence: 'HIGH', sampleSize: 3, lastSaleAt: daysAgo(2) });
  });

  it('uses only the 3 most recent sales regardless of input order', () => {
    const estimate = strategy.estimate([sale(900, 50), sale(100, 1), sale(110, 3), sale(120, 4)], now);
    expect(estimate.valueCents).toBe(11000);
  });

  it('is LOW confidence with fewer than 3 sales, MEDIUM when sales are stale', () => {
    expect(strategy.estimate([sale(100, 1)], now).confidence).toBe('LOW');
    expect(strategy.estimate([sale(100, 100), sale(110, 120), sale(120, 130)], now).confidence).toBe('MEDIUM');
  });

  it('ignores sales older than the max age or in the future', () => {
    const estimate = strategy.estimate([sale(100, 200), sale(500, -1)], now);
    expect(estimate).toEqual({ valueCents: null, confidence: 'NONE', sampleSize: 0, lastSaleAt: null });
  });

  it('records its algorithm id', () => {
    expect(strategy.id).toBe('median-last-3@v1');
  });
});
