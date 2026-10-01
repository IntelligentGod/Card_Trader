import { compactCents, niceTicks } from '../features/home/components/ValueChart';

describe('dashboard value chart axis', () => {
  it('covers the data with round steps', () => {
    // $5,050 – $6,420
    const ticks = niceTicks(505_000, 642_000);
    expect(ticks[0]).toBeLessThanOrEqual(505_000);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(642_000);
    expect(ticks).toEqual([500_000, 550_000, 600_000, 650_000]);
  });

  it('still gives an axis when every value is the same', () => {
    const ticks = niceTicks(10_000, 10_000);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks[0]).toBeLessThanOrEqual(10_000);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(10_000);
  });

  it('formats short dollar labels', () => {
    expect(compactCents(650_000)).toBe('$6.5K');
    expect(compactCents(600_000)).toBe('$6K');
    expect(compactCents(95_000)).toBe('$950');
    expect(compactCents(120_000_000)).toBe('$1.2M');
  });
});
