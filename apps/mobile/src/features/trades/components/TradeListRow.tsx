import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatCents, TRADE_STATUS_LABELS, type TradeListItem } from '@card-trader/shared';
import { AppText } from '../../../components/AppText';
import { Avatar } from '../../../components/Profile';
import { colors, radius, spacing } from '../../../theme';
import { formatDateShort } from '../../../utils/format';

const STATUS_COLOR: Record<TradeListItem['status'], string> = {
  DRAFT: colors.textMuted,
  PROPOSED: colors.primary,
  ACCEPTED: colors.warning,
  COMPLETED: colors.positive,
  CANCELLED: colors.textSubtle,
  DECLINED: colors.negative,
};

export const TradeListRow = memo(function TradeListRow({ trade, onPress }: { trade: TradeListItem; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]} onPress={onPress}>
      <Avatar url={trade.otherUser.avatarUrl} name={trade.otherUser.displayName} size={44} />
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {trade.otherUser.vendorName ?? trade.otherUser.displayName}
        </AppText>
        <AppText variant="caption" color={colors.textMuted}>
          You give {formatCents(trade.myItemsTotalCents)} · get {formatCents(trade.theirItemsTotalCents)} · {trade.itemCount} cards
        </AppText>
        <View style={styles.meta}>
          <AppText variant="caption" color={STATUS_COLOR[trade.status]} style={styles.status}>
            {trade.awaitingMe
              ? trade.isCounterOffer
                ? 'Counteroffer for you'
                : trade.status === 'ACCEPTED'
                  ? 'Confirm when received'
                  : 'Waiting for you'
              : TRADE_STATUS_LABELS[trade.status]}
          </AppText>
          <AppText variant="caption" color={colors.textSubtle}>
            {formatDateShort(trade.completedAt ?? trade.updatedAt)}
          </AppText>
        </View>
      </View>
      {trade.awaitingMe ? <View style={styles.dot} /> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md },
  body: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', gap: spacing.sm },
  status: { fontWeight: '700' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
});
