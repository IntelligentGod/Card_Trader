import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { formatPercent, formatSignedCents } from '@card-trader/shared';
import { colors, radius, spacing } from '../theme';
import { AppText } from './AppText';

interface TrendBadgeProps {
  amountCents?: number;
  percent: number | null;
  suffix?: string;
  size?: 'sm' | 'md';
}

export function trendColors(value: number) {
  if (value > 0) return { fg: colors.positive, bg: colors.positiveSoft, icon: 'trending-up' as const };
  if (value < 0) return { fg: colors.negative, bg: colors.negativeSoft, icon: 'trending-down' as const };
  return { fg: colors.textMuted, bg: colors.surfaceMuted, icon: 'remove' as const };
}

/** Green/red movement indicator: "+$120 · +8.2% this month". */
export function TrendBadge({ amountCents, percent, suffix, size = 'md' }: TrendBadgeProps) {
  const direction = amountCents ?? percent ?? 0;
  const c = trendColors(direction);
  const parts = [amountCents !== undefined ? formatSignedCents(amountCents) : null, percent !== null ? formatPercent(percent) : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <View testID="trend-badge" style={[styles.badge, { backgroundColor: c.bg }, size === 'sm' && styles.small]}>
      <Ionicons name={c.icon} size={size === 'sm' ? 12 : 14} color={c.fg} />
      <AppText variant={size === 'sm' ? 'caption' : 'bodyStrong'} color={c.fg}>
        {parts || '—'}
        {suffix ? ` ${suffix}` : ''}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  small: { paddingHorizontal: spacing.sm, paddingVertical: 2 },
});
