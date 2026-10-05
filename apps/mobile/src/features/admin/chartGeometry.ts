import {
  TRADE_STATUSES,
  type CardCategory,
  type CatalogSource,
  type GradingCompany,
  type ListingStatus,
  type TradeStatus,
} from '@card-trader/shared';

/**
 * Pure chart helpers (no rendering) so the geometry and color rules are unit-tested.
 * Color follows the entity: every entity owns a fixed palette slot, in a fixed
 * order, never cycled — a zero entry is dropped from a pie without shifting others.
 */

/** Categorical palette for light surfaces, slots 1–6. Slots 3–5 are < 3:1, hence legends with values everywhere. */
export const CHART_PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'] as const;
export type ChartSlot = 1 | 2 | 3 | 4 | 5 | 6;

export const BAR_COLOR = CHART_PALETTE[0];

export function slotColor(slot: ChartSlot): string {
  return CHART_PALETTE[slot - 1] ?? CHART_PALETTE[0];
}

export const CATEGORY_SLOT: Record<CardCategory, ChartSlot> = { POKEMON: 1, ONE_PIECE: 2, SPORTS: 3 };
export const LISTING_SLOT: Record<ListingStatus, ChartSlot> = { PERSONAL: 1, FOR_TRADE: 2, FOR_SALE: 3, TRADE_AND_SALE: 4 };
export const SOURCE_SLOT: Record<CatalogSource, ChartSlot> = { SEED: 1, IMPORT: 2, USER_SUBMITTED: 3 };
export const GRADER_SLOT: Record<GradingCompany, ChartSlot> = { PSA: 1, BGS: 2, CGC: 3, OTHER: 4 };
/** Trade statuses take slots 1–6 in TRADE_STATUSES order. */
export const TRADE_STATUS_SLOT = Object.fromEntries(TRADE_STATUSES.map((status, i) => [status, (i + 1) as ChartSlot])) as Record<
  TradeStatus,
  ChartSlot
>;

export interface ChartDatum {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Record → data in the given (fixed) key order, each entity with its own slot color. */
export function chartData<K extends string>(
  values: Partial<Record<K, number>>,
  keys: readonly K[],
  labels: Record<K, string>,
  slots: Record<K, ChartSlot>,
): ChartDatum[] {
  return keys.map((key) => ({ key, label: labels[key], value: values[key] ?? 0, color: slotColor(slots[key]) }));
}

export const PIE_MAX_SLICES = 6;
export const PIE_MIN_NONZERO = 3;
/** Direct % labels only on slices this large; the legend carries the rest. */
export const PIE_LABEL_MIN_FRACTION = 0.08;

/** A pie only for part-to-whole with ≤ 6 parts and at least 3 non-zero; otherwise stat tiles. */
export function canShowPie(data: readonly Pick<ChartDatum, 'value'>[]): boolean {
  return data.length <= PIE_MAX_SLICES && data.filter((d) => d.value > 0).length >= PIE_MIN_NONZERO;
}

export function chartTotal(data: readonly Pick<ChartDatum, 'value'>[]): number {
  return data.reduce((sum, d) => sum + Math.max(0, d.value), 0);
}

/** "42%", "<1%" for tiny non-zero parts, "0%" for none. */
export function percentText(value: number, total: number): string {
  if (total <= 0 || value <= 0) return '0%';
  const pct = (value / total) * 100;
  return pct < 1 ? '<1%' : `${Math.round(pct)}%`;
}

export interface PieSlice {
  key: string;
  color: string;
  value: number;
  fraction: number;
  startAngle: number;
  endAngle: number;
  path: string;
  /** where a direct % label goes (just outside the rim) */
  labelX: number;
  labelY: number;
  showLabel: boolean;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  // 0 rad = 12 o'clock, clockwise
  return { x: cx + r * Math.sin(angle), y: cy - r * Math.cos(angle) };
}

const f = (n: number) => n.toFixed(2);

/** Slices from 12 o'clock clockwise, zero values omitted (their colors stay reserved). */
export function pieSlices(data: readonly ChartDatum[], cx: number, cy: number, r: number, labelR = r + 16): PieSlice[] {
  const total = chartTotal(data);
  if (total <= 0) return [];
  let angle = 0;
  return data
    .filter((d) => d.value > 0)
    .map((d) => {
      const fraction = d.value / total;
      const startAngle = angle;
      const endAngle = angle + fraction * Math.PI * 2;
      angle = endAngle;
      let path: string;
      if (fraction >= 0.9999) {
        // a full circle can't be one arc: draw two half arcs
        const top = polar(cx, cy, r, 0);
        const bottom = polar(cx, cy, r, Math.PI);
        path = `M${f(top.x)},${f(top.y)} A${r},${r} 0 1 1 ${f(bottom.x)},${f(bottom.y)} A${r},${r} 0 1 1 ${f(top.x)},${f(top.y)} Z`;
      } else {
        const start = polar(cx, cy, r, startAngle);
        const end = polar(cx, cy, r, endAngle);
        const large = endAngle - startAngle > Math.PI ? 1 : 0;
        path = `M${f(cx)},${f(cy)} L${f(start.x)},${f(start.y)} A${r},${r} 0 ${large} 1 ${f(end.x)},${f(end.y)} Z`;
      }
      const label = polar(cx, cy, labelR, (startAngle + endAngle) / 2);
      return {
        key: d.key,
        color: d.color,
        value: d.value,
        fraction,
        startAngle,
        endAngle,
        path,
        labelX: label.x,
        labelY: label.y,
        showLabel: fraction >= PIE_LABEL_MIN_FRACTION,
      };
    });
}

/** Round an axis maximum up to 1, 2 or 5 × 10ⁿ. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((m) => m * power >= value) ?? 10;
  return step * power;
}

export interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
  path: string;
}

export const BAR_GAP = 2;
export const BAR_RADIUS = 4;

/** Rect with only the top corners rounded; the baseline stays flat. */
export function barPath(x: number, y: number, width: number, height: number, radius = BAR_RADIUS): string {
  if (height <= 0 || width <= 0) return '';
  const r = Math.min(radius, width / 2, height);
  const bottom = y + height;
  return [
    `M${f(x)},${f(bottom)}`,
    `L${f(x)},${f(y + r)}`,
    `Q${f(x)},${f(y)} ${f(x + r)},${f(y)}`,
    `L${f(x + width - r)},${f(y)}`,
    `Q${f(x + width)},${f(y)} ${f(x + width)},${f(y + r)}`,
    `L${f(x + width)},${f(bottom)}`,
    'Z',
  ].join(' ');
}

/** One bar per value across the full width, 2px apart, scaled against niceMax(max). */
export function barLayout(values: readonly number[], width: number, height: number, gap = BAR_GAP): { bars: BarRect[]; max: number } {
  const max = niceMax(Math.max(0, ...values));
  if (values.length === 0 || width <= 0) return { bars: [], max };
  const barWidth = Math.max(1, (width - gap * (values.length - 1)) / values.length);
  const bars = values.map((value, i) => {
    const h = (Math.max(0, value) / max) * height;
    const x = i * (barWidth + gap);
    const y = height - h;
    return { x, y, width: barWidth, height: h, path: barPath(x, y, barWidth, h) };
  });
  return { bars, max };
}

/** Index of the bar under a touch at x (clamped). */
export function barIndexAt(x: number, width: number, count: number): number {
  if (count <= 0 || width <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.floor((x / width) * count)));
}

/** Label every `every`-th month counting back from the newest, so the latest is always labelled. */
export function labelledMonths(count: number, every = 3): Set<number> {
  const out = new Set<number>();
  for (let i = count - 1; i >= 0; i -= every) out.add(i);
  return out;
}

/** "2026-03" → "Mar" (short) or "Mar 2026" (long), in UTC. */
export function monthLabel(month: string, long = false): string {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (m ?? 1) - 1, 1));
  return date.toLocaleDateString('en-US', long ? { month: 'short', year: 'numeric', timeZone: 'UTC' } : { month: 'short', timeZone: 'UTC' });
}
