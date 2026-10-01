import { StyleSheet, View } from 'react-native';
import { formatCents, percentChange, VALUE_RANGE_LABELS, VALUE_RANGES } from '@card-trader/shared';
import { AppText } from '../../../components/AppText';
import { Segmented, SectionHeader } from '../../../components/Controls';
import { LineChart } from '../../../components/LineChart';
import { PriceText } from '../../../components/PriceText';
import { Disclaimer, Screen } from '../../../components/Screen';
import { SkeletonBlock } from '../../../components/Skeleton';
import { ErrorState } from '../../../components/States';
import { Surface } from '../../../components/Surface';
import { TrendBadge } from '../../../components/TrendBadge';
import type { RootScreenProps } from '../../../navigation/types';
import { useUiPrefs } from '../../../stores/uiPrefs';
import { colors, spacing } from '../../../theme';
import { formatDateLong } from '../../../utils/format';
import { useCollectionItem, useItemPriceHistory } from '../hooks';

const RANGE_OPTIONS = VALUE_RANGES.map((r) => ({ value: r, label: VALUE_RANGE_LABELS[r] }));

export function CardPriceChartScreen({ route }: RootScreenProps<'CardPriceChart'>) {
  const { itemId } = route.params;
  const range = useUiPrefs((s) => s.chartRange);
  const setRange = useUiPrefs((s) => s.setChartRange);
  const item = useCollectionItem(itemId);
  const history = useItemPriceHistory(itemId, range);

  const points = history.data?.points ?? [];
  const first = points[0]?.valueCents;
  const last = points[points.length - 1]?.valueCents;
  const change = first !== undefined && last !== undefined ? last - first : undefined;

  return (
    <Screen refreshing={history.isRefetching} onRefresh={() => void history.refetch()}>
      <View>
        <AppText variant="title">{item.data?.card.name ?? 'Price history'}</AppText>
        <AppText color={colors.primary} variant="bodyStrong">
          {history.data?.tierLabel ?? item.data?.tierLabel ?? ''}
        </AppText>
      </View>

      <Surface style={styles.gap}>
        <AppText variant="label" color={colors.textMuted}>
          Current estimated value
        </AppText>
        <PriceText cents={item.data?.estimatedValueCents} variant="display" />
        {change !== undefined && first !== undefined ? (
          <TrendBadge amountCents={change} percent={percentChange(last!, first)} suffix={`over ${VALUE_RANGE_LABELS[range]}`} />
        ) : null}
      </Surface>

      <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} testID="range-selector" />

      <Surface>
        {history.isPending ? (
          <SkeletonBlock height={220} />
        ) : history.error ? (
          <ErrorState error={history.error} onRetry={() => void history.refetch()} />
        ) : (
          <LineChart points={points} height={220} testID="price-chart" />
        )}
      </Surface>

      <Surface>
        <SectionHeader title="Recent sales" />
        {(history.data?.sales ?? []).slice(0, 15).map((sale) => (
          <View key={sale.id} style={styles.row}>
            <AppText variant="bodyStrong">{formatCents(sale.priceCents)}</AppText>
            <AppText color={colors.textMuted}>
              {formatDateLong(sale.soldAt)} · {sale.source}
            </AppText>
          </View>
        ))}
        {history.data && history.data.sales.length === 0 ? (
          <AppText color={colors.textMuted}>No sales in this period.</AppText>
        ) : null}
      </Surface>
      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs + 2 },
});
