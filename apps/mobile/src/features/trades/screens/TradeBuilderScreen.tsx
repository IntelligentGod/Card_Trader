import { useEffect } from 'react';
import { Alert, View } from 'react-native';
import { errorMessage } from '../../../api/client';
import { api } from '../../../api/endpoints';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { Disclaimer, Screen } from '../../../components/Screen';
import { SkeletonBlock } from '../../../components/Skeleton';
import { ErrorState } from '../../../components/States';
import { Surface } from '../../../components/Surface';
import type { RootScreenProps } from '../../../navigation/types';
import { makeStyles, spacing, useTheme } from '../../../theme';
import { formatDateShort } from '../../../utils/format';
import { CashSummary } from '../components/CashSummary';
import { TradeSide } from '../components/TradeSide';
import { useTrade, useTradeAction } from '../hooks';
import { sidesFor, statusHeadline } from '../tradeText';

export function TradeBuilderScreen({ route, navigation }: RootScreenProps<'TradeBuilder'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tradeId } = route.params;
  const trade = useTrade(tradeId);

  const removeItem = useTradeAction(tradeId, (itemId: string) => api.trades.removeItem(tradeId, itemId));
  const setCash = useTradeAction(tradeId, (body: Parameters<typeof api.trades.setCash>[1]) => api.trades.setCash(tradeId, body));
  const refreshValues = useTradeAction(tradeId, () => api.trades.refreshValues(tradeId));
  const propose = useTradeAction(tradeId, (version: number) => api.trades.propose(tradeId, version));
  const cancel = useTradeAction(tradeId, () => api.trades.cancel(tradeId));

  const editable = trade.data?.allowedActions.includes('EDIT') ?? false;

  // Closed trades are read-only: show the summary instead.
  useEffect(() => {
    if (trade.data && !editable) navigation.replace('TradeConfirmation', { tradeId });
  }, [trade.data, editable, navigation, tradeId]);

  if (trade.isPending) {
    return (
      <Screen>
        <SkeletonBlock height={200} />
        <SkeletonBlock height={200} />
      </Screen>
    );
  }
  if (trade.error) return <ErrorState error={trade.error} onRetry={() => void trade.refetch()} />;

  const data = trade.data;
  const { mine, theirs } = sidesFor(data);
  const canPropose = data.allowedActions.includes('PROPOSE');
  const oldestValuation = [...mine.items, ...theirs.items].map((i) => i.valuedAt).sort()[0];

  const confirmPropose = () =>
    Alert.alert(
      data.proposalCount > 0 ? `Send these terms to ${theirs.user.displayName}?` : `Send offer to ${theirs.user.displayName}?`,
      'They will review these exact cards and cash amount before accepting.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Send offer',
          onPress: () =>
            propose.mutate(data.version, {
              onSuccess: () => navigation.replace('TradeConfirmation', { tradeId }),
              onError: (e) => Alert.alert('Could not send', errorMessage(e)),
            }),
        },
      ],
    );

  const confirmCancel = () =>
    Alert.alert('Cancel this trade?', 'Both of you will see it as cancelled.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel trade', style: 'destructive', onPress: () => cancel.mutate(undefined, { onSuccess: () => navigation.goBack() }) },
    ]);

  return (
    <Screen
      refreshing={trade.isRefetching}
      onRefresh={() => void trade.refetch()}
      footer={
        <>
          {propose.error ? <AppText color={colors.negative}>{errorMessage(propose.error)}</AppText> : null}
          {canPropose ? (
            <Button
              title={data.proposalCount > 0 ? 'Send updated offer' : `Send offer to ${theirs.user.displayName}`}
              icon="paper-plane"
              onPress={confirmPropose}
              loading={propose.isPending}
            />
          ) : null}
          {data.status === 'PROPOSED' || data.status === 'ACCEPTED' ? (
            <Button
              title={data.status === 'ACCEPTED' ? 'Back to accepted trade' : 'Review offer'}
              variant="secondary"
              onPress={() => navigation.navigate('TradeConfirmation', { tradeId })}
            />
          ) : null}
        </>
      }
    >
      <View style={styles.header}>
        <AppText variant="title">Trade with {theirs.user.vendorName ?? theirs.user.displayName}</AppText>
        <AppText color={colors.textMuted}>{statusHeadline(data)}</AppText>
        {data.event ? (
          <AppText variant="caption" color={colors.primary} onPress={() => navigation.navigate('EventDetails', { eventId: data.event!.id })}>
            Started at {data.event.title}
          </AppText>
        ) : null}
      </View>

      {data.status === 'ACCEPTED' ? (
        <Surface style={styles.warning}>
          <AppText variant="bodyStrong" color={colors.warning}>
            This trade was accepted
          </AppText>
          <AppText color={colors.textMuted}>
            Changing cards or cash resets both acceptances and any “received” confirmation. You then send the new terms again.
          </AppText>
        </Surface>
      ) : data.status === 'PROPOSED' && data.proposedByRole !== data.myRole ? (
        <Surface style={styles.warning}>
          <AppText variant="bodyStrong" color={colors.primary}>
            Making a counteroffer
          </AppText>
          <AppText color={colors.textMuted}>Change the cards or cash, then send it back to {theirs.user.displayName}.</AppText>
        </Surface>
      ) : null}

      <TradeSide
        title="My offer"
        side={mine}
        editable={editable}
        onAdd={() => navigation.navigate('TradeAddCards', { tradeId, side: 'mine', publicId: theirs.user.publicId })}
        onRemove={(itemId) => removeItem.mutate(itemId)}
        removingId={removeItem.isPending ? removeItem.variables : null}
      />
      <TradeSide
        title="Their offer"
        side={theirs}
        editable={editable}
        onAdd={() => navigation.navigate('TradeAddCards', { tradeId, side: 'theirs', publicId: theirs.user.publicId })}
        onRemove={(itemId) => removeItem.mutate(itemId)}
        removingId={removeItem.isPending ? removeItem.variables : null}
      />

      <CashSummary trade={data} editable={editable} saving={setCash.isPending} error={setCash.error ?? removeItem.error} onSave={(body) => setCash.mutate(body)} />

      <View style={styles.row}>
        {oldestValuation ? (
          <AppText variant="caption" color={colors.textMuted} style={styles.flex}>
            Values as of {formatDateShort(oldestValuation)}
          </AppText>
        ) : (
          <View style={styles.flex} />
        )}
        <Button title="Refresh values" variant="ghost" compact icon="refresh" onPress={() => refreshValues.mutate()} loading={refreshValues.isPending} />
      </View>

      <Button title="Cancel trade" variant="danger" onPress={confirmCancel} loading={cancel.isPending} />
      <Disclaimer />
    </Screen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  header: { gap: spacing.xs },
  warning: { gap: spacing.xs, backgroundColor: colors.warningSoft },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
}));
