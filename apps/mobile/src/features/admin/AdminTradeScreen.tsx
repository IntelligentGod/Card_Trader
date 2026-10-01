import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatCents, TRADE_STATUS_LABELS, type AdminTradeDetail, type TradeParticipantResponse } from '@card-trader/shared';
import { AppText } from '../../components/AppText';
import { Avatar, ReviewCard } from '../../components/Profile';
import { Disclaimer, Screen } from '../../components/Screen';
import { SkeletonBlock } from '../../components/Skeleton';
import { ErrorState } from '../../components/States';
import { Surface } from '../../components/Surface';
import type { RootScreenProps } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme';
import { TradeSide } from '../trades/components/TradeSide';
import { adminCashText, formatTimestamp } from './adminText';
import { TRADE_STATUS_COLOR } from './components';
import { useAdminTrade } from './hooks';

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <AppText color={colors.textMuted}>{label}</AppText>
      <AppText variant={strong ? 'bodyStrong' : 'body'} style={styles.lineValue}>
        {value}
      </AppText>
    </View>
  );
}

function Participant({ side, label, onPress }: { side: TradeParticipantResponse; label: string; onPress: () => void }) {
  const { user } = side;
  return (
    <Pressable style={({ pressed }) => [styles.participant, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button">
      <Avatar url={user.avatarUrl} name={user.displayName} size={40} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {user.displayName}
          {user.vendorName ? <AppText color={colors.primary}> · {user.vendorName}</AppText> : null}
        </AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {label} · @{user.username}
          {side.hasAcceptedCurrentVersion ? ' · Accepted' : ''}
          {side.completionConfirmed ? ' · Confirmed received' : ''}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

function timeline(trade: AdminTradeDetail): { label: string; at: string }[] {
  const steps: [string, string | null][] = [
    ['Created', trade.createdAt],
    ['Proposed', trade.proposedAt],
    ['Accepted', trade.acceptedAt],
    ['Completed', trade.completedAt],
    ['Declined', trade.declinedAt],
    ['Cancelled', trade.cancelledAt],
    ['Last updated', trade.updatedAt],
  ];
  return steps.flatMap(([label, at]) => (at ? [{ label, at }] : []));
}

export function AdminTradeScreen({ route, navigation }: RootScreenProps<'AdminTrade'>) {
  const { tradeId } = route.params;
  const trade = useAdminTrade(tradeId);

  if (trade.isPending) {
    return (
      <Screen>
        <SkeletonBlock height={120} />
        <SkeletonBlock height={260} />
      </Screen>
    );
  }
  if (trade.error) return <ErrorState error={trade.error} onRetry={() => void trade.refetch()} />;

  const data = trade.data;
  const initiator = data.initiator.user.displayName;
  const counterparty = data.counterparty.user.displayName;
  const nameOf = (role: 'INITIATOR' | 'COUNTERPARTY') => (role === 'INITIATOR' ? initiator : counterparty);
  const { calculation, event } = data;
  const openUser = (publicId: string) => navigation.navigate('AdminUser', { publicId });

  return (
    <Screen refreshing={trade.isRefetching} onRefresh={() => void trade.refetch()}>
      <Surface style={styles.group}>
        <View style={styles.statusRow}>
          <AppText variant="heading" color={TRADE_STATUS_COLOR[data.status]}>
            {TRADE_STATUS_LABELS[data.status]}
          </AppText>
          <AppText variant="caption" color={colors.textSubtle} selectable>
            #{data.id}
          </AppText>
        </View>
        <AppText variant="caption" color={colors.textMuted}>
          {data.proposalCount} {data.proposalCount === 1 ? 'offer' : 'offers'} sent
          {data.isCounterOffer ? ' · current one is a counteroffer' : ''}
          {data.proposedByRole ? ` · last sent by ${nameOf(data.proposedByRole)}` : ''} · version {data.version}
        </AppText>
        {event ? (
          <Pressable style={styles.event} onPress={() => navigation.navigate('EventDetails', { eventId: event.id })}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <AppText variant="bodyStrong" color={colors.primary} numberOfLines={1} style={styles.flex}>
              {event.title}
            </AppText>
          </Pressable>
        ) : null}
        <Participant side={data.initiator} label="Initiator" onPress={() => openUser(data.initiator.user.publicId)} />
        <Participant side={data.counterparty} label="Counterparty" onPress={() => openUser(data.counterparty.user.publicId)} />
      </Surface>

      <TradeSide title={`${initiator} gives`} side={data.initiator} showDetails />
      <TradeSide title={`${counterparty} gives`} side={data.counterparty} showDetails />

      <Surface style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          Calculation
        </AppText>
        <Line label={`${initiator}’s cards`} value={formatCents(calculation.initiatorTotalCents)} />
        <Line label={`${counterparty}’s cards`} value={formatCents(calculation.counterpartyTotalCents)} />
        <Line label="Difference" value={formatCents(Math.abs(calculation.differenceCents))} />
        <Line
          label="Suggested cash"
          value={
            calculation.suggestedCashPayer && calculation.suggestedCashCents > 0
              ? `${nameOf(calculation.suggestedCashPayer)} pays ${formatCents(calculation.suggestedCashCents)}`
              : 'None'
          }
        />
        {calculation.hasUnpricedItems ? (
          <AppText variant="caption" color={colors.warning}>
            Some cards have no market estimate and count as $0.
          </AppText>
        ) : null}
        <AppText testID="admin-trade-cash" variant="heading" color={colors.primary}>
          {adminCashText(data.cash, initiator, counterparty)}
        </AppText>
      </Surface>

      <Surface style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          Final trade value
        </AppText>
        <Line label={`${initiator} gives`} value={formatCents(data.finalValue.initiatorGivesCents)} strong />
        <Line label={`${counterparty} gives`} value={formatCents(data.finalValue.counterpartyGivesCents)} strong />
      </Surface>

      <Surface style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          Timeline
        </AppText>
        {timeline(data).map((step) => (
          <Line key={step.label} label={step.label} value={formatTimestamp(step.at)} />
        ))}
      </Surface>

      <View>
        <AppText variant="label" color={colors.textMuted} style={styles.reviewsTitle}>
          Reviews
        </AppText>
        {data.reviews.length ? (
          data.reviews.map((review) => <ReviewCard key={review.id} review={review} />)
        ) : (
          <AppText color={colors.textMuted}>No reviews on this trade.</AppText>
        )}
      </View>

      <Disclaimer text={data.disclaimer || undefined} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: spacing.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  event: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  participant: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  pressed: { opacity: 0.85 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg },
  lineValue: { flexShrink: 1, textAlign: 'right' },
  reviewsTitle: { marginBottom: spacing.sm },
});
