import { Ionicons } from '@expo/vector-icons';
import { Alert, StyleSheet, View } from 'react-native';
import { formatCents, TRADE_STATUS_LABELS } from '@card-trader/shared';
import { errorMessage } from '../../../api/client';
import { api } from '../../../api/endpoints';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { RatingStars } from '../../../components/Profile';
import { Disclaimer, Screen } from '../../../components/Screen';
import { SkeletonBlock } from '../../../components/Skeleton';
import { ErrorState } from '../../../components/States';
import { Surface } from '../../../components/Surface';
import type { RootScreenProps } from '../../../navigation/types';
import { colors, radius, spacing } from '../../../theme';
import { formatDateLong } from '../../../utils/format';
import { CashSummary } from '../components/CashSummary';
import { TradeSide } from '../components/TradeSide';
import { useTrade, useTradeAction } from '../hooks';
import { sidesFor, statusHeadline } from '../tradeText';

export function TradeConfirmationScreen({ route, navigation }: RootScreenProps<'TradeConfirmation'>) {
  const { tradeId } = route.params;
  const trade = useTrade(tradeId);
  const accept = useTradeAction(tradeId, (version: number) => api.trades.accept(tradeId, version));
  const decline = useTradeAction(tradeId, () => api.trades.decline(tradeId));
  const complete = useTradeAction(tradeId, () => api.trades.complete(tradeId));
  const cancel = useTradeAction(tradeId, () => api.trades.cancel(tradeId));

  if (trade.isPending) {
    return (
      <Screen>
        <SkeletonBlock height={260} />
      </Screen>
    );
  }
  if (trade.error) return <ErrorState error={trade.error} onRetry={() => void trade.refetch()} />;

  const data = trade.data;
  const { mine, theirs } = sidesFor(data);
  const can = (action: (typeof data.allowedActions)[number]) => data.allowedActions.includes(action);
  const mutationError = accept.error ?? decline.error ?? complete.error ?? cancel.error;
  const closed = ['COMPLETED', 'CANCELLED', 'DECLINED'].includes(data.status);

  const confirmAccept = () =>
    Alert.alert(
      'Accept this trade?',
      `You give ${formatCents(mine.itemsTotalCents)} in cards and receive ${formatCents(theirs.itemsTotalCents)}. If anyone changes the terms later, both acceptances reset.`,
      [
        { text: 'Review again', style: 'cancel' },
        { text: 'Accept', onPress: () => accept.mutate(data.version) },
      ],
    );

  const confirmComplete = () =>
    Alert.alert(
      'Confirm received',
      `Only confirm after you have received ${theirs.user.displayName}’s cards${data.cash.payer && data.cash.payer !== data.myRole ? ' and cash' : ''}. The trade completes — and both inventories update — when both of you confirm.`,
      [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Confirm received', onPress: () => complete.mutate() },
      ],
    );

  const changeAcceptedTerms = () =>
    Alert.alert('Change the accepted terms?', 'Both acceptances and any “received” confirmation will reset. You then send the new terms again.', [
      { text: 'Keep as is', style: 'cancel' },
      { text: 'Change terms', onPress: () => navigation.navigate('TradeBuilder', { tradeId }) },
    ]);

  const confirm = (title: string, run: () => void) =>
    Alert.alert(title, undefined, [
      { text: 'Back', style: 'cancel' },
      { text: title, style: 'destructive', onPress: run },
    ]);

  return (
    <Screen
      refreshing={trade.isRefetching}
      onRefresh={() => void trade.refetch()}
      footer={
        closed && !can('REVIEW') ? undefined : (
          <>
            {mutationError ? <AppText color={colors.negative}>{errorMessage(mutationError)}</AppText> : null}
            {can('ACCEPT') ? <Button title="Accept trade" icon="checkmark" onPress={confirmAccept} loading={accept.isPending} /> : null}
            {can('COMPLETE') ? (
              <Button title="Confirm received" icon="checkmark-done" onPress={confirmComplete} loading={complete.isPending} />
            ) : null}
            {can('REVIEW') ? (
              <Button
                title={`Review ${theirs.user.displayName}`}
                icon="star"
                onPress={() => navigation.navigate('ReviewUser', { tradeId, displayName: theirs.user.displayName })}
              />
            ) : null}
            <View style={styles.row}>
              {can('COUNTER') ? (
                <Button title="Counter" icon="git-compare-outline" variant="secondary" compact style={styles.flex} onPress={() => navigation.navigate('TradeBuilder', { tradeId })} />
              ) : can('EDIT') ? (
                <Button
                  title={data.status === 'ACCEPTED' ? 'Change terms' : 'Edit'}
                  variant="secondary"
                  compact
                  style={styles.flex}
                  onPress={data.status === 'ACCEPTED' ? changeAcceptedTerms : () => navigation.navigate('TradeBuilder', { tradeId })}
                />
              ) : null}
              {can('DECLINE') ? (
                <Button title="Decline" variant="danger" compact style={styles.flex} onPress={() => confirm('Decline', () => decline.mutate())} />
              ) : null}
              {can('CANCEL') && !can('DECLINE') ? (
                <Button title="Cancel trade" variant="danger" compact style={styles.flex} onPress={() => confirm('Cancel trade', () => cancel.mutate())} />
              ) : null}
            </View>
          </>
        )
      }
    >
      <Surface style={[styles.banner, data.status === 'COMPLETED' && styles.bannerDone]}>
        <Ionicons
          name={data.status === 'COMPLETED' ? 'checkmark-circle' : closed ? 'close-circle' : 'time-outline'}
          size={26}
          color={data.status === 'COMPLETED' ? colors.positive : closed ? colors.textMuted : colors.primary}
        />
        <View style={styles.flex}>
          <AppText variant="heading">{statusHeadline(data)}</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {data.isCounterOffer ? 'Counteroffer' : TRADE_STATUS_LABELS[data.status]} · with {theirs.user.vendorName ?? theirs.user.displayName}
            {data.completedAt ? ` · ${formatDateLong(data.completedAt)}` : ''}
            {data.event ? ` · at ${data.event.title}` : ''}
          </AppText>
        </View>
      </Surface>

      <TradeSide title="You give" side={mine} showDetails />
      <TradeSide title="You receive" side={theirs} showDetails />
      <CashSummary trade={data} editable={false} />

      <Surface style={styles.final}>
        <AppText variant="label" color={colors.textMuted}>
          Final trade value
        </AppText>
        <View style={styles.finalRow}>
          <AppText>You give</AppText>
          <AppText variant="bodyStrong">
            {formatCents(data.myRole === 'INITIATOR' ? data.finalValue.initiatorGivesCents : data.finalValue.counterpartyGivesCents)}
          </AppText>
        </View>
        <View style={styles.finalRow}>
          <AppText>You receive</AppText>
          <AppText variant="bodyStrong">
            {formatCents(data.myRole === 'INITIATOR' ? data.finalValue.counterpartyGivesCents : data.finalValue.initiatorGivesCents)}
          </AppText>
        </View>
        {data.status === 'COMPLETED' ? (
          <AppText variant="caption" color={colors.textMuted}>
            Values, grades, cert numbers and comps are frozen as they were when the trade was accepted.
          </AppText>
        ) : null}
      </Surface>

      {data.myReview ? (
        <Surface style={styles.review}>
          <AppText variant="label" color={colors.textMuted}>
            Your review
          </AppText>
          <RatingStars rating={data.myReview.rating} />
          {data.myReview.comment ? <AppText>{data.myReview.comment}</AppText> : null}
        </Surface>
      ) : null}
      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg },
  bannerDone: { backgroundColor: colors.positiveSoft },
  final: { gap: spacing.sm },
  finalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  review: { gap: spacing.xs },
});
