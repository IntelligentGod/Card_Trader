import {
  barIndexAt,
  barLayout,
  barPath,
  canShowPie,
  CATEGORY_SLOT,
  CHART_PALETTE,
  chartData,
  labelledMonths,
  monthLabel,
  niceMax,
  percentText,
  pieSlices,
  slotColor,
  TRADE_STATUS_SLOT,
} from '../features/admin/chartGeometry';

const labels = { POKEMON: 'Pokémon', ONE_PIECE: 'One Piece', SPORTS: 'Sports' };
const keys = ['POKEMON', 'ONE_PIECE', 'SPORTS'] as const;

describe('chart colors', () => {
  it('pins each entity to its slot, never by rank', () => {
    const data = chartData({ POKEMON: 1, ONE_PIECE: 500, SPORTS: 20 }, keys, labels, CATEGORY_SLOT);
    expect(data.map((d) => d.color)).toEqual([CHART_PALETTE[0], CHART_PALETTE[1], CHART_PALETTE[2]]);
    expect(slotColor(TRADE_STATUS_SLOT.DRAFT)).toBe('#2a78d6');
    expect(slotColor(TRADE_STATUS_SLOT.DECLINED)).toBe('#008300');
  });

  it('keeps colors when a zero entry is dropped from the pie', () => {
    const data = chartData({ POKEMON: 0, ONE_PIECE: 3, SPORTS: 1 }, keys, labels, CATEGORY_SLOT);
    const slices = pieSlices(data, 100, 100, 80);
    expect(slices.map((s) => s.key)).toEqual(['ONE_PIECE', 'SPORTS']);
    expect(slices.map((s) => s.color)).toEqual(['#eb6834', '#1baf7a']);
  });
});

describe('pie rules', () => {
  it('needs ≤ 6 parts and at least 3 non-zero', () => {
    expect(canShowPie([{ value: 1 }, { value: 2 }, { value: 3 }])).toBe(true);
    expect(canShowPie([{ value: 1 }, { value: 2 }, { value: 0 }])).toBe(false);
    expect(canShowPie(Array.from({ length: 7 }, () => ({ value: 1 })))).toBe(false);
  });

  it('builds slices clockwise from 12 o’clock and labels only big ones', () => {
    const data = chartData({ POKEMON: 50, ONE_PIECE: 45, SPORTS: 5 }, keys, labels, CATEGORY_SLOT);
    const slices = pieSlices(data, 100, 100, 80);
    expect(slices[0]!.startAngle).toBe(0);
    expect(slices[0]!.endAngle).toBeCloseTo(Math.PI);
    expect(slices[2]!.endAngle).toBeCloseTo(Math.PI * 2);
    expect(slices.map((s) => s.showLabel)).toEqual([true, true, false]);
    expect(slices[0]!.path.startsWith('M100.00,100.00 L100.00,20.00 A80,80 0 0 1')).toBe(true);
    // the second slice (45%) is not the large arc; a 60% slice would be
    expect(slices[1]!.path).toContain(' 0 0 1 ');
    const big = pieSlices(chartData({ POKEMON: 60, ONE_PIECE: 30, SPORTS: 10 }, keys, labels, CATEGORY_SLOT), 100, 100, 80);
    expect(big[0]!.path).toContain(' 0 1 1 ');
  });

  it('returns nothing for an empty total and formats percentages', () => {
    expect(pieSlices(chartData({}, keys, labels, CATEGORY_SLOT), 0, 0, 10)).toEqual([]);
    expect(percentText(1, 3)).toBe('33%');
    expect(percentText(1, 1000)).toBe('<1%');
    expect(percentText(0, 10)).toBe('0%');
  });
});

describe('bar layout', () => {
  it('scales against a nice maximum with a 2px gap and a flat baseline', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(130)).toBe(200);
    expect(niceMax(500)).toBe(500);
    const { bars, max } = barLayout([0, 5, 10], 104, 100);
    expect(max).toBe(10);
    expect(bars.map((b) => b.width)).toEqual([100 / 3, 100 / 3, 100 / 3]);
    expect(bars[1]!.x).toBeCloseTo(100 / 3 + 2);
    expect(bars.map((b) => b.height)).toEqual([0, 50, 100]);
    expect(bars[0]!.path).toBe('');
    expect(bars[2]!.y + bars[2]!.height).toBe(100);
  });

  it('rounds only the top corners', () => {
    expect(barPath(0, 10, 20, 50)).toBe('M0.00,60.00 L0.00,14.00 Q0.00,10.00 4.00,10.00 L16.00,10.00 Q20.00,10.00 20.00,14.00 L20.00,60.00 Z');
  });

  it('maps a touch to a bar and labels only a few months', () => {
    expect(barIndexAt(0, 120, 12)).toBe(0);
    expect(barIndexAt(119, 120, 12)).toBe(11);
    expect(barIndexAt(500, 120, 12)).toBe(11);
    expect([...labelledMonths(12)].sort((a, b) => a - b)).toEqual([2, 5, 8, 11]);
    expect(monthLabel('2026-03')).toBe('Mar');
    expect(monthLabel('2026-03', true)).toBe('Mar 2026');
  });
});
