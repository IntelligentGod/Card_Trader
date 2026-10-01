import { StyleSheet, View } from 'react-native';
import { formatCents, isForSale, LISTING_STATUS_LABELS, type ListingStatus } from '@card-trader/shared';
import { colors, radius } from '../theme';
import { AppText } from './AppText';

const TONE: Record<ListingStatus, { fg: string; bg: string }> = {
  PERSONAL: { fg: colors.textMuted, bg: colors.surfaceMuted },
  FOR_TRADE: { fg: colors.positive, bg: colors.positiveSoft },
  FOR_SALE: { fg: colors.primary, bg: colors.primarySoft },
  TRADE_AND_SALE: { fg: colors.primary, bg: colors.primarySoft },
};

/** "For trade" / "For sale · $45" pill. Hidden for personal cards unless `showPersonal`. */
export function ListingBadge({
  status,
  askingPriceCents,
  showPersonal = false,
}: {
  status: ListingStatus;
  askingPriceCents?: number | null;
  showPersonal?: boolean;
}) {
  if (status === 'PERSONAL' && !showPersonal) return null;
  const tone = TONE[status];
  const asking = isForSale(status) && askingPriceCents != null ? ` · ${formatCents(askingPriceCents)}` : '';
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <AppText variant="caption" color={tone.fg} style={styles.text} numberOfLines={1}>
        {LISTING_STATUS_LABELS[status]}
        {asking}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-end', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  text: { fontWeight: '700' },
});
