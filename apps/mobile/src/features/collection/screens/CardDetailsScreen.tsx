import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { CATEGORY_LABELS, CONDITION_LABELS, formatCents, formatSignedCents, LISTING_STATUS_LABELS } from '@card-trader/shared';
import { errorMessage } from '../../../api/client';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { CardArt } from '../../../components/CardArt';
import { SectionHeader } from '../../../components/Controls';
import { LineChart } from '../../../components/LineChart';
import { PriceText } from '../../../components/PriceText';
import { Disclaimer, Screen } from '../../../components/Screen';
import { SkeletonBlock } from '../../../components/Skeleton';
import { ErrorState } from '../../../components/States';
import { Surface } from '../../../components/Surface';
import { trendColors } from '../../../components/TrendBadge';
import type { RootScreenProps } from '../../../navigation/types';
import { colors, spacing } from '../../../theme';
import { cardSubtitle, formatDateShort } from '../../../utils/format';
import { useCollectionItem, useDeleteItem, useItemMarketValue, useItemPriceHistory } from '../hooks';

const CONFIDENCE_TEXT = {
  HIGH: 'Based on 3 recent comparable sales',
  MEDIUM: 'Based on older comparable sales',
  LOW: 'Few comparable sales — treat as a rough guide',
  NONE: 'No comparable sales yet',
} as const;

export function CardDetailsScreen({ route, navigation }: RootScreenProps<'CardDetails'>) {
  const { itemId } = route.params;
  const item = useCollectionItem(itemId);
  const market = useItemMarketValue(itemId);
  const history = useItemPriceHistory(itemId, '30d');
  const remove = useDeleteItem(itemId);

  if (item.isPending) {
    return (
      <Screen>
        <SkeletonBlock height={240} />
        <SkeletonBlock height={120} />
      </Screen>
    );
  }
  if (item.error) return <ErrorState error={item.error} onRetry={() => void item.refetch()} />;

  const data = item.data;
  const gain =
    data.totalValueCents !== null && data.purchasePriceCents !== null ? data.totalValueCents - data.purchasePriceCents * data.quantity : null;

  const confirmDelete = () =>
    Alert.alert('Remove card?', `${data.card.name} will be removed from your collection.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          remove.mutate(undefined, {
            onSuccess: () => navigation.goBack(),
            onError: (e) => Alert.alert('Could not remove', errorMessage(e)),
          }),
      },
    ]);

  return (
    <Screen
      refreshing={item.isRefetching}
      onRefresh={() => {
        void item.refetch();
        void market.refetch();
        void history.refetch();
      }}
    >
      <View style={styles.hero}>
        <View style={styles.photos}>
          <CardArt imageUrl={data.imageUrl} name={data.card.name} category={data.card.category} cardNumber={data.card.cardNumber} width={data.backImageUrl ? 110 : 150} />
          {data.backImageUrl ? <CardArt imageUrl={data.backImageUrl} name={`${data.card.name} (back)`} category={data.card.category} width={110} /> : null}
        </View>
        <View style={styles.heroText}>
          <AppText variant="label" color={colors.textMuted}>
            {CATEGORY_LABELS[data.card.category]}
          </AppText>
          <AppText variant="title">{data.card.name}</AppText>
          <AppText color={colors.textMuted}>{cardSubtitle(data.card)}</AppText>
          <AppText variant="bodyStrong" color={colors.primary}>
            {data.tierLabel}
          </AppText>
        </View>
      </View>

      <Surface style={styles.gap}>
        <AppText variant="label" color={colors.textMuted}>
          Estimated value
        </AppText>
        <PriceText cents={data.estimatedValueCents} variant="display" />
        {data.quantity > 1 && data.totalValueCents !== null ? (
          <AppText color={colors.textMuted}>
            {data.quantity} copies · {formatCents(data.totalValueCents)} total
          </AppText>
        ) : null}
        {market.data ? (
          <AppText variant="caption" color={colors.textMuted}>
            {CONFIDENCE_TEXT[market.data.confidence]}
          </AppText>
        ) : null}
        {gain !== null ? (
          <AppText variant="bodyStrong" color={trendColors(gain).fg}>
            {formatSignedCents(gain)} vs. what you paid
          </AppText>
        ) : null}
      </Surface>

      <Surface>
        <SectionHeader title="Last sold" />
        {market.isPending ? (
          <SkeletonBlock height={72} />
        ) : market.data && market.data.recentSales.length > 0 ? (
          market.data.recentSales.map((sale, index) => (
            <View key={sale.id} style={styles.saleRow}>
              <AppText color={colors.textMuted}>{index + 1}.</AppText>
              <AppText variant="bodyStrong" style={styles.flex}>
                {formatCents(sale.priceCents)}
              </AppText>
              <AppText color={colors.textMuted}>
                {formatDateShort(sale.soldAt)} · {sale.source}
              </AppText>
            </View>
          ))
        ) : (
          <AppText color={colors.textMuted}>No comparable sales yet. Prices refresh in the background.</AppText>
        )}
      </Surface>

      <Pressable onPress={() => navigation.navigate('CardPriceChart', { itemId })}>
        <Surface>
          <View style={styles.chartHeader}>
            <AppText variant="heading">Price history</AppText>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </View>
          {history.data ? <LineChart points={history.data.points} height={120} /> : <SkeletonBlock height={120} />}
        </Surface>
      </Pressable>

      <Surface style={styles.gap}>
        <Detail label="Condition" value={CONDITION_LABELS[data.condition]} />
        {data.certNumber ? <Detail label="Cert #" value={data.certNumber} /> : null}
        <Detail label="Quantity" value={String(data.quantity)} />
        <Detail label="Status" value={LISTING_STATUS_LABELS[data.listingStatus]} />
        {data.askingPriceCents !== null ? <Detail label="Asking price" value={formatCents(data.askingPriceCents)} /> : null}
        {data.eventIds.length > 0 ? (
          <Detail label="Bringing to" value={`${data.eventIds.length} upcoming ${data.eventIds.length === 1 ? 'show' : 'shows'}`} />
        ) : null}
        {data.purchasePriceCents !== null ? <Detail label="Paid" value={formatCents(data.purchasePriceCents)} /> : null}
        {data.purchaseDate ? <Detail label="Purchased" value={data.purchaseDate} /> : null}
        {data.notes ? <Detail label="Notes" value={data.notes} /> : null}
        {data.lockedInTrade ? (
          <AppText variant="caption" color={colors.warning}>
            This card is committed to an accepted trade.
          </AppText>
        ) : null}
      </Surface>

      <View style={styles.actions}>
        <Button title="Edit" icon="create-outline" variant="secondary" style={styles.flex} onPress={() => navigation.navigate('EditCollectionItem', { itemId })} />
        <Button title="Remove" icon="trash-outline" variant="danger" style={styles.flex} onPress={confirmDelete} loading={remove.isPending} disabled={data.lockedInTrade} />
      </View>
      <Disclaimer />
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <AppText color={colors.textMuted}>{label}</AppText>
      <AppText variant="bodyStrong" style={styles.detailValue}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  photos: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  hero: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, alignItems: 'center' },
  heroText: { flex: 1, minWidth: 160, gap: spacing.xs },
  gap: { gap: spacing.sm },
  saleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  detail: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg },
  detailValue: { flexShrink: 1, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: spacing.md },
});
