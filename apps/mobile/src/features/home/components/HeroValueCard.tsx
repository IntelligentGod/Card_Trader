import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { formatCents, formatPercent, formatSignedCents, type PortfolioSummary } from '@card-trader/shared';
import { AppText } from '../../../components/AppText';
import { SkeletonBlock } from '../../../components/Skeleton';
import { ErrorState } from '../../../components/States';
import { colors, radius, spacing } from '../../../theme';

interface HeroValueCardProps {
  summary: PortfolioSummary | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onViewInventory: () => void;
}

/** Blue gradient banner with the collection value, today / 30-day movement, and a link to the inventory. */
export function HeroValueCard({ summary, loading, error, onRetry, onViewInventory }: HeroValueCardProps) {
  return (
    <View style={styles.card}>
      <HeroBackdrop />
      <View style={styles.content}>
        <AppText variant="label" color="rgba(255,255,255,0.85)">
          Collection value
        </AppText>
        {loading ? (
          <SkeletonBlock width={200} height={44} />
        ) : error || !summary ? (
          <ErrorState error={error} onRetry={onRetry} />
        ) : (
          <>
            <AppText testID="home-total" variant="display" color={colors.white} style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
              {formatCents(summary.totalValueCents)}
            </AppText>
            <View style={styles.pills}>
              <ChangePill amountCents={summary.change['1d'].amountCents} percent={summary.change['1d'].percent} suffix="today" />
              <ChangePill amountCents={summary.change['30d'].amountCents} percent={summary.change['30d'].percent} suffix="30d" />
            </View>
            <AppText variant="caption" color="rgba(255,255,255,0.9)">
              {summary.cardCount} {summary.cardCount === 1 ? 'card' : 'cards'}
              {summary.unpricedCount > 0 ? ` · ${summary.unpricedCount} awaiting a price` : ''}
            </AppText>
          </>
        )}
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          onPress={onViewInventory}
          accessibilityRole="button"
        >
          <AppText variant="bodyStrong" color={colors.primary}>
            View inventory
          </AppText>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

function ChangePill({ amountCents, percent, suffix }: { amountCents: number; percent: number | null; suffix: string }) {
  const tone = amountCents > 0 ? colors.positive : amountCents < 0 ? colors.negative : colors.textMuted;
  const icon = amountCents > 0 ? 'trending-up' : amountCents < 0 ? 'trending-down' : 'remove';
  return (
    <View style={styles.pill} testID="trend-badge">
      <Ionicons name={icon} size={13} color={tone} />
      <AppText variant="caption" color={tone} style={styles.pillText}>
        {formatSignedCents(amountCents)}
        {percent !== null ? `  ${formatPercent(percent)}` : ''} {suffix}
      </AppText>
    </View>
  );
}

/**
 * Decorative art drawn in SVG (no bitmap assets): a gradient sky, soft glows,
 * a fan of trading cards and sparkles on the right-hand side.
 */
function HeroBackdrop() {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 360 190" preserveAspectRatio="xMaxYMid slice" pointerEvents="none">
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#3D5BF0" />
          <Stop offset="0.6" stopColor="#4F86F7" />
          <Stop offset="1" stopColor="#7DB8FF" />
        </LinearGradient>
        <LinearGradient id="cardA" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFD84D" />
          <Stop offset="1" stopColor="#F2A900" />
        </LinearGradient>
        <LinearGradient id="cardB" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FF8A80" />
          <Stop offset="1" stopColor="#E0443E" />
        </LinearGradient>
        <LinearGradient id="cardC" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#8FD3FF" />
          <Stop offset="1" stopColor="#2C6BE6" />
        </LinearGradient>
      </Defs>
      <Rect width="360" height="190" fill="url(#sky)" />
      <Circle cx="300" cy="40" r="70" fill="#FFFFFF" opacity={0.1} />
      <Circle cx="215" cy="20" r="26" fill="#FFFFFF" opacity={0.08} />
      <Circle cx="340" cy="175" r="60" fill="#FFFFFF" opacity={0.08} />
      {/* Fan of three cards */}
      <G transform="translate(282 112) rotate(-20)">
        <Rect x="-30" y="-42" width="60" height="84" rx="7" fill="url(#cardC)" stroke="#FFFFFF" strokeWidth="3" />
        <Rect x="-22" y="-32" width="44" height="34" rx="4" fill="#FFFFFF" opacity={0.75} />
      </G>
      <G transform="translate(306 106) rotate(2)">
        <Rect x="-30" y="-42" width="60" height="84" rx="7" fill="url(#cardB)" stroke="#FFFFFF" strokeWidth="3" />
        <Rect x="-22" y="-32" width="44" height="34" rx="4" fill="#FFFFFF" opacity={0.75} />
      </G>
      <G transform="translate(328 116) rotate(22)">
        <Rect x="-30" y="-42" width="60" height="84" rx="7" fill="url(#cardA)" stroke="#FFFFFF" strokeWidth="3" />
        <Rect x="-22" y="-32" width="44" height="34" rx="4" fill="#FFFFFF" opacity={0.8} />
        <Path d="M0 -26 L5 -15 L-2 -15 L3 -4 L-6 -18 L1 -18 Z" fill="#F2A900" />
        <Rect x="-22" y="10" width="44" height="4" rx="2" fill="#FFFFFF" opacity={0.7} />
        <Rect x="-22" y="19" width="30" height="4" rx="2" fill="#FFFFFF" opacity={0.7} />
      </G>
      {/* Sparkles */}
      <Sparkle x={250} y={46} size={11} />
      <Sparkle x={344} y={30} size={7} />
      <Sparkle x={236} y={150} size={6} />
    </Svg>
  );
}

function Sparkle({ x, y, size }: { x: number; y: number; size: number }) {
  const s = size;
  const k = s * 0.22;
  return <Path d={`M${x} ${y - s} L${x + k} ${y - k} L${x + s} ${y} L${x + k} ${y + k} L${x} ${y + s} L${x - k} ${y + k} L${x - s} ${y} L${x - k} ${y - k} Z`} fill="#FFFFFF" opacity={0.9} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg + 2,
    overflow: 'hidden',
    backgroundColor: '#4F86F7',
    shadowColor: '#2F4FD8',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  content: { padding: spacing.lg, gap: spacing.sm, paddingRight: 96 },
  value: { fontSize: 38 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  pillText: { fontWeight: '700' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  pressed: { opacity: 0.85 },
});
