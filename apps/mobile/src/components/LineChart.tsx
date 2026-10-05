import { useMemo, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { formatCents, type ValuePoint } from '@card-trader/shared';
import { spacing, useTheme } from '../theme';
import { AppText } from './AppText';

interface LineChartProps {
  points: readonly ValuePoint[];
  height?: number;
  testID?: string;
}

export interface ChartGeometry {
  line: string;
  area: string;
  coords: { x: number; y: number }[];
  min: number;
  max: number;
  rising: boolean;
}

/** Pure geometry so it can be unit-tested without rendering. */
export function buildChartGeometry(points: readonly ValuePoint[], width: number, height: number): ChartGeometry | null {
  if (points.length < 2 || width <= 0) return null;
  const values = points.map((p) => p.valueCents);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(1, max * 0.1);
  const padTop = 8;
  const padBottom = 8;
  const usable = height - padTop - padBottom;
  const coords = values.map((value, index) => ({
    x: (index / (values.length - 1)) * width,
    y: padTop + usable - ((value - min) / span) * usable,
  }));
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  return { line, area, coords, min, max, rising: values[values.length - 1]! >= values[0]! };
}

function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Simple, fast SVG line chart with touch scrubbing. */
export function LineChart({ points, height = 180, testID }: LineChartProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const geometry = useMemo(() => buildChartGeometry(points, width, height), [points, width, height]);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const scrub = (event: GestureResponderEvent) => {
    if (!geometry) return;
    const x = event.nativeEvent.locationX;
    const index = Math.round((x / width) * (points.length - 1));
    setActive(Math.max(0, Math.min(points.length - 1, index)));
  };

  if (points.length < 2) {
    return (
      <View testID={testID} style={[styles.empty, { height }]}>
        <AppText color={colors.textMuted} align="center">
          Not enough price history yet
        </AppText>
      </View>
    );
  }

  const stroke = geometry?.rising === false ? colors.negative : colors.positive;
  const activePoint = active !== null ? points[active] : null;
  const activeCoord = active !== null ? geometry?.coords[active] : null;

  return (
    <View testID={testID}>
      <View style={styles.scrubLabel}>
        {activePoint ? (
          <AppText variant="caption" color={colors.textMuted}>
            {formatDate(activePoint.date)} · <AppText variant="caption" color={colors.text}>{formatCents(activePoint.valueCents)}</AppText>
          </AppText>
        ) : (
          <AppText variant="caption" color={colors.textSubtle}>
            Touch and drag to explore
          </AppText>
        )}
      </View>
      <View
        onLayout={onLayout}
        style={{ height }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={scrub}
        onResponderMove={scrub}
        onResponderRelease={() => setActive(null)}
        onResponderTerminate={() => setActive(null)}
      >
        {geometry ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={stroke} stopOpacity={0.22} />
                <Stop offset="1" stopColor={stroke} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={geometry.area} fill="url(#fill)" />
            <Path d={geometry.line} stroke={stroke} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {activeCoord ? (
              <>
                <Line x1={activeCoord.x} x2={activeCoord.x} y1={0} y2={height} stroke={colors.border} strokeWidth={1} />
                <Circle cx={activeCoord.x} cy={activeCoord.y} r={5} fill={colors.surface} stroke={stroke} strokeWidth={2.5} />
              </>
            ) : null}
          </Svg>
        ) : null}
      </View>
      <View style={styles.axis}>
        <AppText variant="caption" color={colors.textSubtle}>
          {formatDate(points[0]!.date)}
        </AppText>
        {geometry ? (
          <AppText variant="caption" color={colors.textSubtle}>
            {formatCents(geometry.min)} – {formatCents(geometry.max)}
          </AppText>
        ) : null}
        <AppText variant="caption" color={colors.textSubtle}>
          {formatDate(points[points.length - 1]!.date)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  scrubLabel: { height: 20, marginBottom: spacing.xs },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
});
