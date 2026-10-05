import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Path, Text as SvgText } from 'react-native-svg';
import { AppText } from '../../components/AppText';
import { Surface } from '../../components/Surface';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import {
  BAR_COLOR,
  barIndexAt,
  barLayout,
  canShowPie,
  chartTotal,
  labelledMonths,
  monthLabel,
  percentText,
  pieSlices,
  type ChartDatum,
} from './chartGeometry';
import { StatTile } from './components';

type Format = (value: number) => string;
const plain: Format = (value) => value.toLocaleString('en-US');

/** Titled card with a "Show as table" toggle; the table carries the same numbers as the chart. */
function ChartCard({
  title,
  table,
  children,
  canTable = true,
}: {
  title: string;
  table: ReactNode;
  children: ReactNode;
  canTable?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [asTable, setAsTable] = useState(false);
  return (
    <Surface style={styles.card}>
      <View style={styles.cardHeader}>
        <AppText variant="bodyStrong" style={styles.flex}>
          {title}
        </AppText>
        {canTable ? (
          <Pressable onPress={() => setAsTable((v) => !v)} hitSlop={12} accessibilityRole="button">
            <AppText variant="caption" color={colors.primary} style={styles.toggle}>
              {asTable ? 'Show as chart' : 'Show as table'}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {asTable ? table : children}
    </Surface>
  );
}

function TableRows({ rows }: { rows: { key: string; label: string; value: string; extra?: string }[] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View testID="chart-table">
      {rows.map((row) => (
        <View key={row.key} style={styles.tableRow}>
          <AppText style={styles.flex}>{row.label}</AppText>
          <AppText variant="bodyStrong">{row.value}</AppText>
          {row.extra !== undefined ? (
            <AppText color={colors.textMuted} style={styles.pct}>
              {row.extra}
            </AppText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const PIE_SIZE = 220;
const PIE_R = 78;

/**
 * Part-to-whole pie with a legend (swatch, label, value, %) that is always shown.
 * Falls back to stat tiles when a pie would mislead (> 6 parts or < 3 non-zero).
 */
export function PieChart({ title, data, format = plain, testID }: { title: string; data: ChartDatum[]; format?: Format; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const total = chartTotal(data);
  const slices = useMemo(() => pieSlices(data, PIE_SIZE / 2, PIE_SIZE / 2, PIE_R), [data]);
  const rows = data.map((d) => ({ key: d.key, label: d.label, value: format(d.value), extra: percentText(d.value, total) }));

  if (!canShowPie(data)) {
    return (
      <Surface style={styles.card} testID={testID}>
        <AppText variant="bodyStrong">{title}</AppText>
        <View style={styles.grid}>
          {data.map((d) => (
            <StatTile key={d.key} label={d.label} value={format(d.value)} hint={percentText(d.value, total)} />
          ))}
        </View>
      </Surface>
    );
  }

  const active = data.find((d) => d.key === selected) ?? null;
  const toggle = (key: string) => setSelected((current) => (current === key ? null : key));
  const summary = `${title}: ${rows.map((r) => `${r.label} ${r.value} (${r.extra})`).join(', ')}`;

  return (
    <View testID={testID}>
      <ChartCard title={title} table={<TableRows rows={rows} />}>
        <View style={styles.pieWrap} accessible accessibilityRole="image" accessibilityLabel={summary}>
          <Svg width={PIE_SIZE} height={PIE_SIZE}>
            {slices.map((slice) => (
              <Path
                key={slice.key}
                d={slice.path}
                fill={slice.color}
                stroke={colors.surface}
                strokeWidth={2}
                strokeLinejoin="round"
                opacity={selected && selected !== slice.key ? 0.35 : 1}
                onPress={() => toggle(slice.key)}
              />
            ))}
            {slices
              .filter((slice) => slice.showLabel)
              .map((slice) => (
                <SvgText
                  key={`label-${slice.key}`}
                  x={slice.labelX}
                  y={slice.labelY + 4}
                  fontSize={12}
                  fontWeight="600"
                  fill={colors.text}
                  textAnchor="middle"
                >
                  {percentText(slice.value, total)}
                </SvgText>
              ))}
          </Svg>
        </View>
        <AppText variant="caption" color={active ? colors.text : colors.textSubtle} align="center">
          {active ? `${active.label}: ${format(active.value)} · ${percentText(active.value, total)}` : 'Tap a slice or a row for details'}
        </AppText>
        <View>
          {data.map((d) => (
            <Pressable
              key={d.key}
              onPress={() => toggle(d.key)}
              style={[styles.legendRow, selected === d.key && styles.legendActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: selected === d.key }}
            >
              <View style={[styles.swatch, { backgroundColor: d.color }]} />
              <AppText style={styles.flex} numberOfLines={1}>
                {d.label}
              </AppText>
              <AppText variant="bodyStrong">{format(d.value)}</AppText>
              <AppText color={colors.textMuted} style={styles.pct}>
                {percentText(d.value, total)}
              </AppText>
            </Pressable>
          ))}
        </View>
      </ChartCard>
    </View>
  );
}

const BAR_HEIGHT = 140;
const GUTTER = 36;
const X_AXIS = 20;

/** Single-series monthly bars (one hue, no legend — the title names the series). Tap a bar for its value. */
export function BarChart({
  title,
  points,
  format = plain,
  testID,
}: {
  title: string;
  points: { month: string; value: number }[];
  format?: Format;
  testID?: string;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const plotWidth = Math.max(0, width - GUTTER);
  const { bars, max } = useMemo(() => barLayout(points.map((p) => p.value), plotWidth, BAR_HEIGHT), [points, plotWidth]);
  const labelled = labelledMonths(points.length);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const pick = (event: GestureResponderEvent) => {
    const x = event.nativeEvent.locationX - GUTTER;
    if (x < 0) return;
    const index = barIndexAt(x, plotWidth, points.length);
    setSelected((current) => (current === index ? null : index));
  };

  const active = selected !== null ? points[selected] : undefined;
  const total = points.reduce((sum, p) => sum + p.value, 0);
  const first = points[0];
  const last = points[points.length - 1];
  const summary =
    first && last
      ? `${title}, ${monthLabel(first.month, true)} to ${monthLabel(last.month, true)}: total ${format(total)}, latest ${format(last.value)}`
      : `${title}: no data`;
  const rows = points.map((p) => ({ key: p.month, label: monthLabel(p.month, true), value: format(p.value) }));

  return (
    <View testID={testID}>
      <ChartCard title={title} table={<TableRows rows={rows} />}>
        <AppText variant="caption" color={active ? colors.text : colors.textSubtle}>
          {active ? `${monthLabel(active.month, true)} · ${format(active.value)}` : 'Tap a bar for details'}
        </AppText>
        <View
          onLayout={onLayout}
          style={{ height: BAR_HEIGHT + X_AXIS }}
          accessible
          accessibilityRole="image"
          accessibilityLabel={summary}
          onStartShouldSetResponder={() => true}
          onResponderGrant={pick}
        >
          {width > 0 ? (
            <Svg width={width} height={BAR_HEIGHT + X_AXIS}>
              {[0, 0.5, 1].map((t) => {
                const y = BAR_HEIGHT - t * BAR_HEIGHT;
                return (
                  <G key={t}>
                    <Line x1={GUTTER} x2={width} y1={y} y2={y} stroke={colors.divider} strokeWidth={StyleSheet.hairlineWidth} />
                    {t > 0 ? (
                      <SvgText x={GUTTER - 6} y={y + 4} fontSize={10} fill={colors.textSubtle} textAnchor="end">
                        {format(max * t)}
                      </SvgText>
                    ) : null}
                  </G>
                );
              })}
              <G x={GUTTER}>
                {bars.map((bar, i) =>
                  bar.path ? (
                    <Path key={points[i]!.month} d={bar.path} fill={BAR_COLOR} opacity={selected !== null && selected !== i ? 0.4 : 1} />
                  ) : null,
                )}
                {bars.map((bar, i) =>
                  labelled.has(i) ? (
                    <SvgText key={`x-${points[i]!.month}`} x={bar.x + bar.width / 2} y={BAR_HEIGHT + 14} fontSize={10} fill={colors.textSubtle} textAnchor="middle">
                      {monthLabel(points[i]!.month)}
                    </SvgText>
                  ) : null,
                )}
              </G>
            </Svg>
          ) : null}
        </View>
      </ChartCard>
    </View>
  );
}

/** Two-part share as a meter bar (e.g. raw vs graded), with both values written out. */
export function MeterTile({
  title,
  left,
  right,
}: {
  title: string;
  left: { label: string; value: number; color: string };
  right: { label: string; value: number; color: string };
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const total = left.value + right.value;
  const share = total > 0 ? left.value / total : 0;
  return (
    <Surface
      style={styles.card}
      accessible
      accessibilityLabel={`${title}: ${left.label} ${left.value} (${percentText(left.value, total)}), ${right.label} ${right.value} (${percentText(right.value, total)})`}
    >
      <AppText variant="bodyStrong">{title}</AppText>
      <View style={styles.meter}>
        {left.value > 0 ? <View style={{ flex: share, backgroundColor: left.color }} /> : null}
        {left.value > 0 && right.value > 0 ? <View style={styles.meterGap} /> : null}
        {right.value > 0 ? <View style={{ flex: 1 - share, backgroundColor: right.color }} /> : null}
      </View>
      {[left, right].map((part) => (
        <View key={part.label} style={styles.legendRow}>
          <View style={[styles.swatch, { backgroundColor: part.color }]} />
          <AppText style={styles.flex}>{part.label}</AppText>
          <AppText variant="bodyStrong">{part.value.toLocaleString('en-US')}</AppText>
          <AppText color={colors.textMuted} style={styles.pct}>
            {percentText(part.value, total)}
          </AppText>
        </View>
      ))}
    </Surface>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: { gap: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggle: { fontWeight: '600' },
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pieWrap: { alignItems: 'center' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.xs, borderRadius: radius.sm },
  legendActive: { backgroundColor: colors.surfaceMuted },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  pct: { width: 44, textAlign: 'right' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 36,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  meter: { flexDirection: 'row', height: 12, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  meterGap: { width: 2, backgroundColor: colors.surface },
}));
