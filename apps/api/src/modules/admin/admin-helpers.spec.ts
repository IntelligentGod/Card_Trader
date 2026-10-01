import { countsByKey, lastMonths } from './admin-analytics.service';
import { diffFields } from './admin-audit.service';

describe('diffFields', () => {
  it('keeps only fields that were sent and actually change', () => {
    expect(
      diffFields(
        { name: 'Tom', bio: null, links: { x: '@tom' }, location: 'Austin' },
        { name: 'Tom', bio: 'Hi', links: { x: '@tom' }, location: undefined },
      ),
    ).toEqual({ bio: { from: null, to: 'Hi' } });
  });

  it('compares objects by value and treats undefined/null alike', () => {
    expect(diffFields({ links: { x: '@a' } }, { links: { x: '@b' } })).toEqual({ links: { from: { x: '@a' }, to: { x: '@b' } } });
    expect(diffFields({ bio: undefined }, { bio: null })).toEqual({});
  });
});

describe('lastMonths', () => {
  it('returns the last N months ending with the current one, oldest first', () => {
    expect(lastMonths(new Date('2026-03-15T12:00:00Z'), 4)).toEqual(['2025-12', '2026-01', '2026-02', '2026-03']);
  });

  it('uses UTC months', () => {
    expect(lastMonths(new Date('2026-01-31T23:30:00Z'), 1)).toEqual(['2026-01']);
  });
});

describe('countsByKey', () => {
  it('lists every key, fills missing ones with 0 and ignores unknown or null keys', () => {
    expect(
      countsByKey(['A', 'B', 'C'] as const, [
        { key: 'A', count: 2 },
        { key: null, count: 5 },
        { key: 'Z', count: 1 },
      ]),
    ).toEqual({ A: 2, B: 0, C: 0 });
  });
});
