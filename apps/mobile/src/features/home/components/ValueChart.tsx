import { useMemo, useState } from 'react';
import { View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { formatCents, type ValuePoint } from '@card-trader/shared';
import { AppText } from '../../../components/AppText';
import { makeStyles, radius, spacing, useTheme } from '../../../theme';

const AXIS_WIDTH = 46;
const PAD_TOP = 34; // room for the callout above the last point
const PAD_BOTTOM = 6;

/** Rounded tick values covering [min, max]: 4 steps of 1/2/2.5/5 × 10^n. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || Math.max(100, Math.abs(max) * 0.1);
  const raw = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * magnitude >= raw) ?? 10) * magnitude;
  const start = Math.floor(min / step) * step;
  const ticks = [start];
  while (ticks[ticks.length - 1]! < max - step * 0.001 || ticks.length < 2) ticks.push(ticks[ticks.length - 1]! + step);
  return ticks;
}

/** "$6.5K", "$950", "$1.2M" — short labels for the y axis. */
export function compactCents(cents: number): string {
  const dollars = cents / 100;
  const abs = Math.abs(dollars);
  if (abs >= 1_000_000) return `$${trim(dollars / 1_000_000)}M`;
  if (abs >= 1_000) return `$${trim(dollars / 1_000)}K`;
  return `$${Math.round(dollars)}`;
}
const trim = (n: number) => (Math.round(n * 10) / 10).toString();

function shortDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
function longDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Area chart for the dashboard: value axis on the left, ~5 date ticks, the
 * latest value called out at the end of the line, and touch scrubbing.
 */
export function ValueChart({ points, height = 170 }: { points: readonly ValuePoint[]; height?: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const plotWidth = Math.max(0, width - AXIS_WIDTH);

  const geo = useMemo(() => {
    if (points.length < 2 || plotWidth <= 0) return null;
    const values = points.map((p) => p.valueCents);
    const ticks = niceTicks(Math.min(...values), Math.max(...values));
    const lo = ticks[0]!;
    const hi = ticks[ticks.length - 1]!;
    const usable = height - PAD_TOP - PAD_BOTTOM;
    const y = (v: number) => PAD_TOP + usable - ((v - lo) / (hi - lo || 1)) * usable;
    // Leave a margin on the right so the end marker isn't clipped.
    const x = (i: number) => (i / (points.length - 1)) * (plotWidth - 8);
    const coords = values.map((v, i) => ({ x: x(i), y: y(v) }));
    const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const last = coords[coords.length - 1]!;
    const area = `${line} L${last.x},${height} L0,${height} Z`;
    const tickCount = Math.min(5, points.length);
    const dateTicks = Array.from({ length: tickCount }, (_, k) => Math.round((k / (tickCount - 1)) * (points.length - 1)));
    return { coords, line, area, ticks: ticks.map((t) => ({ value: t, y: y(t) })), dateTicks, rising: values[values.length - 1]! >= values[0]! };
  }, [points, plotWidth, height]);

  if (points.length < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <AppText color={colors.textMuted} align="center">
          Not enough price history yet
        </AppText>
      </View>
    );
  }

  const stroke = geo?.rising === false ? colors.negative : colors.positive;
  const focus = active ?? points.length - 1;
  const focusPoint = points[focus]!;
  const focusCoord = geo?.coords[focus];

  const scrub = (event: GestureResponderEvent) => {
    if (!geo) return;
    const x = event.nativeEvent.locationX;
    const index = Math.round((x / (plotWidth - 8)) * (points.length - 1));
    setActive(Math.max(0, Math.min(points.length - 1, index)));
  };

  // Keep the callout inside the plot.
  const calloutWidth = 104;
  const calloutLeft = focusCoord ? Math.min(Math.max(focusCoord.x - calloutWidth / 2, 0), plotWidth - calloutWidth) : 0;
  const calloutTop = focusCoord ? Math.max(0, focusCoord.y - 46) : 0;

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} accessibilityLabel={`Collection value chart, ${formatCents(focusPoint.valueCents)} on ${longDate(focusPoint.date)}`}>
      <View style={[styles.row, { height }]}>
        <View style={{ width: AXIS_WIDTH, height }}>
          {geo?.ticks.map((t) => (
            <AppText key={t.value} variant="caption" color={colors.textSubtle} style={[styles.yLabel, { top: t.y - 8 }]}>
              {compactCents(t.value)}
            </AppText>
          ))}
        </View>
        <View
          style={{ width: plotWidth, height }}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={scrub}
          onResponderMove={scrub}
          onResponderRelease={() => setActive(null)}
          onResponderTerminate={() => setActive(null)}
        >
          {geo ? (
            <Svg width={plotWidth} height={height}>
              <Defs>
                <LinearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={stroke} stopOpacity={0.22} />
                  <Stop offset="1" stopColor={stroke} stopOpacity={0.02} />
                </LinearGradient>
              </Defs>
              {geo.ticks.map((t) => (
                <Line key={t.value} x1={0} x2={plotWidth} y1={t.y} y2={t.y} stroke={colors.border} strokeWidth={1} strokeDasharray="3 4" />
              ))}
              <Path d={geo.area} fill="url(#valueFill)" />
              <Path d={geo.line} stroke={stroke} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
              {active !== null && focusCoord ? (
                <Line x1={focusCoord.x} x2={focusCoord.x} y1={focusCoord.y} y2={height} stroke={stroke} strokeOpacity={0.4} strokeWidth={1} />
              ) : null}
              {focusCoord ? <Circle cx={focusCoord.x} cy={focusCoord.y} r={5} fill={stroke} stroke={colors.surface} strokeWidth={2} /> : null}
            </Svg>
          ) : null}
          {focusCoord ? (
            <View pointerEvents="none" style={[styles.callout, { left: calloutLeft, top: calloutTop, width: calloutWidth }]}>
              <AppText variant="caption" color={colors.positive} style={[styles.calloutValue, { color: stroke }]}>
                {formatCents(focusPoint.valueCents)}
              </AppText>
              <AppText variant="caption" color={colors.textMuted} style={styles.calloutDate}>
                {longDate(focusPoint.date)}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
      <View style={[styles.xAxis, { marginLeft: AXIS_WIDTH, width: plotWidth }]}>
        {geo?.dateTicks.map((i, k) => (
          <AppText
            key={i}
            variant="caption"
            color={colors.textSubtle}
            style={[styles.xLabel, { left: Math.min(Math.max(geo.coords[i]!.x - 24, 0), plotWidth - 48) }, k === 0 && { left: 0, textAlign: 'left' }]}
          >
            {shortDate(points[i]!.date)}
          </AppText>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, shadow }) => ({
  empty: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  yLabel: { position: 'absolute', left: 0, fontSize: 11 },
  xAxis: { height: 18, marginTop: spacing.xs },
  xLabel: { position: 'absolute', width: 48, textAlign: 'center', fontSize: 11 },
  callout: {
    position: 'absolute',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  calloutValue: { fontWeight: '800' },
  calloutDate: { fontSize: 11 },
}));
