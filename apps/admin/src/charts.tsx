import { useRef, useState, type ReactNode } from 'react';
import {
  CARD_CATEGORIES,
  GRADING_COMPANIES,
  LISTING_STATUSES,
  TRADE_STATUSES,
  type CardCategory,
  type CatalogSource,
  type GradingCompany,
  type ListingStatus,
  type TradeStatus,
} from '@card-trader/shared';

// ───────────── Palette (fixed order, never cycled; validated for CVD on #fcfcfb) ─────────────

export const CHART_SURFACE = '#fcfcfb';
export const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'] as const;
export const INK = { primary: '#0b0b0b', secondary: '#52514e', muted: '#898781' };
const GRID = '#e1e0d9';
const BASELINE = '#c3c2b7';

/** Color follows the entity: each value keeps its slot even when others are zero. */
function slotMap<K extends string>(keys: readonly K[]): Record<K, string> {
  const out = {} as Record<K, string>;
  keys.forEach((k, i) => {
    out[k] = PALETTE[i] ?? PALETTE[PALETTE.length - 1]!;
  });
  return out;
}

export const CATEGORY_COLORS = slotMap<CardCategory>(CARD_CATEGORIES);
export const LISTING_COLORS = slotMap<ListingStatus>(LISTING_STATUSES);
export const TRADE_STATUS_COLORS = slotMap<TradeStatus>(TRADE_STATUSES);
export const SOURCE_COLORS = slotMap<CatalogSource>(['SEED', 'IMPORT', 'USER_SUBMITTED']);
export const GRADER_COLORS = slotMap<GradingCompany>(GRADING_COMPANIES);

// ───────────── Shared bits ─────────────

const pct = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);
const fmtPct = (p: number) => `${p < 10 && p > 0 ? p.toFixed(1) : Math.round(p)}%`;

interface TooltipState {
  x: number;
  y: number;
  content: ReactNode;
}

function Tooltip({ tip }: { tip: TooltipState | null }) {
  if (!tip) return null;
  return (
    <div className="chart-tooltip" style={{ left: tip.x, top: tip.y }} role="status">
      {tip.content}
    </div>
  );
}

/** Tooltip positioning relative to the chart container, for both mouse and keyboard focus. */
function useTooltip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TooltipState | null>(null);
  const atMouse = (e: { clientX: number; clientY: number }, content: ReactNode) => {
    const box = ref.current?.getBoundingClientRect();
    if (box) setTip({ x: e.clientX - box.left, y: e.clientY - box.top, content });
  };
  /** Places the tooltip at an SVG point (viewBox units) — used on keyboard focus. */
  const atPoint = (svg: SVGSVGElement | null, vbWidth: number, x: number, y: number, content: ReactNode) => {
    const box = ref.current?.getBoundingClientRect();
    const svgBox = svg?.getBoundingClientRect();
    if (!box || !svgBox) return;
    const k = svgBox.width / vbWidth;
    setTip({ x: svgBox.left - box.left + x * k, y: svgBox.top - box.top + y * k, content });
  };
  return { ref, tip, atMouse, atPoint, clear: () => setTip(null) };
}

// ───────────── Chart card with Table toggle ─────────────

export function ChartCard({
  title,
  subtitle,
  table,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  table: ReactNode;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="chart-card">
      <div className="chart-card-head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <div className="chart-subtitle">{subtitle}</div> : null}
        </div>
        <button
          type="button"
          className="btn btn-small"
          aria-pressed={showTable}
          onClick={() => setShowTable((s) => !s)}
        >
          {showTable ? 'Chart' : 'Table'}
        </button>
      </div>
      {showTable ? <div className="chart-table">{table}</div> : children}
    </section>
  );
}

export function DataTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <table className="table compact">
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th key={c} className={i > 0 ? 'num' : undefined}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((cell, j) => (
              <td key={j} className={j > 0 ? 'num' : undefined}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ───────────── Pie ─────────────

export interface PieDatum {
  key: string;
  label: string;
  value: number;
  color: string;
}

const PIE_VB = 240;
const PIE_C = PIE_VB / 2;
const PIE_R = 88;

function polar(r: number, angle: number): [number, number] {
  return [PIE_C + r * Math.cos(angle), PIE_C + r * Math.sin(angle)];
}

function wedge(r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${PIE_C} ${PIE_C} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

/** The pie's data as a table (also used by the Table toggle). */
export function PieTable({ data, format }: { data: PieDatum[]; format: (n: number) => string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <DataTable
      columns={['Segment', 'Value', 'Share']}
      rows={[
        ...data.map((d) => [d.label, format(d.value), fmtPct(pct(d.value, total))]),
        [<strong key="t">Total</strong>, <strong key="v">{format(total)}</strong>, '100%'],
      ]}
    />
  );
}

function Legend({ data, format }: { data: PieDatum[]; format: (n: number) => string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ul className="legend">
      {data.map((d) => (
        <li key={d.key} className={d.value === 0 ? 'legend-zero' : undefined}>
          <span className="legend-swatch" style={{ background: d.color }} aria-hidden />
          <span className="legend-label">{d.label}</span>
          <span className="legend-value">{format(d.value)}</span>
          <span className="legend-pct">{fmtPct(pct(d.value, total))}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Part-to-whole with ≤ 6 slices. Falls back to stat tiles when fewer than 3 slices are non-zero.
 * `data` must be in the entity's fixed order with its fixed colors.
 */
export function PieChart({
  data,
  format,
  title,
}: {
  data: PieDatum[];
  format: (n: number) => string;
  title: string;
}) {
  const tt = useTooltip();
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const nonZero = data.filter((d) => d.value > 0);

  if (nonZero.length < 3) {
    return (
      <div className="mini-tiles">
        {data.map((d) => (
          <div key={d.key} className="mini-tile">
            <div className="mini-tile-label">
              <span className="legend-swatch" style={{ background: d.color }} aria-hidden />
              {d.label}
            </div>
            <div className="mini-tile-value">{format(d.value)}</div>
            <div className="mini-tile-hint">{fmtPct(pct(d.value, total))}</div>
          </div>
        ))}
      </div>
    );
  }

  let angle = -Math.PI / 2;
  const slices = nonZero.map((d) => {
    const share = d.value / total;
    const a0 = angle;
    const a1 = angle + share * Math.PI * 2;
    angle = a1;
    const mid = (a0 + a1) / 2;
    return { d, a0, a1, mid, share };
  });
  const tipContent = (d: PieDatum, share: number) => (
    <>
      <strong>{d.label}</strong>
      <div>
        {format(d.value)} · {fmtPct(share * 100)}
      </div>
    </>
  );
  const summary = `${title}: ${nonZero.map((d) => `${d.label} ${format(d.value)} (${fmtPct(pct(d.value, total))})`).join(', ')}`;

  return (
    <div className="pie-wrap" ref={tt.ref}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${PIE_VB} ${PIE_VB}`}
        className="pie"
        role="img"
        aria-label={summary}
        onMouseLeave={() => {
          tt.clear();
          setActive(null);
        }}
      >
        {slices.map(({ d, a0, a1 }) => (
          <path
            key={d.key}
            d={wedge(PIE_R, a0, a1)}
            fill={d.color}
            stroke={CHART_SURFACE}
            strokeWidth={2}
            strokeLinejoin="round"
            opacity={active && active !== d.key ? 0.55 : 1}
          />
        ))}
        {slices
          .filter((s) => s.share >= 0.08)
          .map(({ d, mid, share }) => {
            const [x, y] = polar(PIE_R + 16, mid);
            return (
              <text
                key={d.key}
                x={x}
                y={y}
                className="pie-label"
                textAnchor="middle"
                dominantBaseline="middle"
                fill={INK.secondary}
              >
                {fmtPct(share * 100)}
              </text>
            );
          })}
        {/* Invisible hit areas, larger than the visible slice, for hover and keyboard focus. */}
        {slices.map(({ d, a0, a1, mid, share }) => (
          <path
            key={`hit-${d.key}`}
            d={wedge(PIE_R + 10, a0, a1)}
            fill="transparent"
            className="hit"
            tabIndex={0}
            aria-label={`${d.label}: ${format(d.value)}, ${fmtPct(share * 100)}`}
            onMouseMove={(e) => {
              setActive(d.key);
              tt.atMouse(e, tipContent(d, share));
            }}
            onFocus={() => {
              setActive(d.key);
              const [x, y] = polar(PIE_R * 0.6, mid);
              tt.atPoint(svgRef.current, PIE_VB, x, y, tipContent(d, share));
            }}
            onBlur={() => {
              setActive(null);
              tt.clear();
            }}
          />
        ))}
      </svg>
      <Legend data={data} format={format} />
      <Tooltip tip={tt.tip} />
    </div>
  );
}

// ───────────── Bar (single series, single hue) ─────────────

export interface BarDatum {
  key: string;
  label: string;
  value: number;
}

const BAR_W = 640;
const BAR_H = 220;
const M = { top: 12, right: 12, bottom: 28, left: 56 };

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= max) return m * exp;
  return 10 * exp;
}

function barPath(x: number, y: number, w: number, base: number): string {
  const h = base - y;
  if (h <= 0) return '';
  const r = Math.min(4, h, w / 2);
  return `M ${x} ${base} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${base} Z`;
}

export function BarChart({
  data,
  format,
  tickFormat = format,
  title,
}: {
  data: BarDatum[];
  format: (n: number) => string;
  tickFormat?: (n: number) => string;
  title: string;
}) {
  const tt = useTooltip();
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<string | null>(null);
  if (data.length === 0) return <div className="state state-empty">No data.</div>;

  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const innerW = BAR_W - M.left - M.right;
  const innerH = BAR_H - M.top - M.bottom;
  const base = M.top + innerH;
  const band = innerW / data.length;
  const barW = Math.max(2, Math.min(band - 2, 26));
  const y = (v: number) => base - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  // Label only a few months (every third, anchored on the latest).
  const labelled = (i: number) => (data.length - 1 - i) % 3 === 0;
  const tipContent = (d: BarDatum) => (
    <>
      <strong>{d.label}</strong>
      <div>{format(d.value)}</div>
    </>
  );
  const summary = `${title}: ${data.map((d) => `${d.label} ${format(d.value)}`).join(', ')}`;

  return (
    <div className="bar-wrap" ref={tt.ref}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${BAR_W} ${BAR_H}`}
        className="bar-chart"
        role="img"
        aria-label={summary}
        onMouseLeave={() => {
          tt.clear();
          setActive(null);
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            {t > 0 && <line x1={M.left} x2={BAR_W - M.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />}
            <text x={M.left - 8} y={y(t)} className="axis-text" textAnchor="end" dominantBaseline="middle" fill={INK.muted}>
              {tickFormat(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = M.left + i * band + (band - barW) / 2;
          return (
            <path
              key={d.key}
              d={barPath(x, y(d.value), barW, base)}
              fill={PALETTE[0]}
              opacity={active && active !== d.key ? 0.6 : 1}
            />
          );
        })}
        <line x1={M.left} x2={BAR_W - M.right} y1={base} y2={base} stroke={BASELINE} strokeWidth={1} />
        {data.map((d, i) =>
          labelled(i) ? (
            <text
              key={`l-${d.key}`}
              x={M.left + i * band + band / 2}
              y={base + 16}
              className="axis-text"
              textAnchor="middle"
              fill={INK.muted}
            >
              {d.label}
            </text>
          ) : null,
        )}
        {/* Full-height hit areas per bar. */}
        {data.map((d, i) => (
          <rect
            key={`hit-${d.key}`}
            x={M.left + i * band}
            y={M.top}
            width={band}
            height={innerH}
            fill="transparent"
            className="hit"
            tabIndex={0}
            aria-label={`${d.label}: ${format(d.value)}`}
            onMouseMove={(e) => {
              setActive(d.key);
              tt.atMouse(e, tipContent(d));
            }}
            onFocus={() => {
              setActive(d.key);
              tt.atPoint(svgRef.current, BAR_W, M.left + i * band + band / 2, y(d.value), tipContent(d));
            }}
            onBlur={() => {
              setActive(null);
              tt.clear();
            }}
          />
        ))}
      </svg>
      <Tooltip tip={tt.tip} />
    </div>
  );
}

// ───────────── Meter ─────────────

export function Meter({ value, total, label }: { value: number; total: number; label: string }) {
  const p = pct(value, total);
  return (
    <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p)} aria-label={label}>
      <div className="meter-fill" style={{ width: `${p}%`, background: PALETTE[0] }} />
    </div>
  );
}

export { fmtPct, pct };
