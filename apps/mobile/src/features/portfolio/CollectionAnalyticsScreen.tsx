import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  CATEGORY_LABELS,
  formatCents,
  formatPercent,
  formatSignedCents,
  VALUE_RANGE_LABELS,
  VALUE_RANGES,
  type Mover,
  type MoverWindow,
} from '@card-trader/shared';
import { AppText } from '../../components/AppText';
import { CardRow } from '../../components/CardRow';
import { Segmented, SectionHeader } from '../../components/Controls';
import { LineChart } from '../../components/LineChart';
import { Disclaimer, Screen } from '../../components/Screen';
import { SkeletonBlock } from '../../components/Skeleton';
import { ErrorState } from '../../components/States';
import { Surface } from '../../components/Surface';
import { TrendBadge, trendColors } from '../../components/TrendBadge';
import type { RootScreenProps } from '../../navigation/types';
import { useUiPrefs } from '../../stores/uiPrefs';
import { categoryColors, colors, radius, spacing } from '../../theme';
import { cardSubtitle } from '../../utils/format';
import { useMovers, usePortfolioHistory, usePortfolioSummary, useTopCards } from './hooks';

const WINDOWS: { value: MoverWindow; label: string }[] = [
  { value: '1d', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

export function CollectionAnalyticsScreen({ navigation }: RootScreenProps<'CollectionAnalytics'>) {
  const range = useUiPrefs((s) => s.chartRange);
  const setRange = useUiPrefs((s) => s.setChartRange);
  const [moverWindow, setMoverWindow] = useState<MoverWindow>('7d');
  const summary = usePortfolioSummary();
  const history = usePortfolioHistory(range);
  const top = useTopCards();
  const gainers = useMovers('up', moverWindow);
  const losers = useMovers('down', moverWindow);

  const refresh = () => {
    void summary.refetch();
    void history.refetch();
    void top.refetch();
    void gainers.refetch();
    void losers.refetch();
  };

  if (summary.error) return <ErrorState error={summary.error} onRetry={refresh} />;
  const total = summary.data?.totalValueCents ?? 0;

  const renderMover = (mover: Mover) => (
    <CardRow
      key={mover.item.id}
      name={mover.item.card.name}
      subtitle={cardSubtitle(mover.item.card)}
      tierLabel={mover.item.tierLabel}
      category={mover.item.card.category}
      imageUrl={mover.item.imageUrl}
      valueCents={mover.currentValueCents}
      trailing={
        <AppText variant="caption" color={trendColors(mover.changeCents).fg}>
          {formatSignedCents(mover.changeCents)} ({formatPercent(mover.percent)})
        </AppText>
      }
      onPress={() => navigation.navigate('CardDetails', { itemId: mover.item.id })}
    />
  );

  return (
    <Screen refreshing={summary.isRefetching} onRefresh={refresh}>
      <Surface style={styles.gap}>
        <AppText variant="label" color={colors.textMuted}>
          Total value
        </AppText>
        {summary.data ? (
          <>
            <AppText variant="display">{formatCents(total)}</AppText>
            <View style={styles.badges}>
              {WINDOWS.map((w) => (
                <TrendBadge key={w.value} amountCents={summary.data.change[w.value].amountCents} percent={summary.data.change[w.value].percent} suffix={w.label.toLowerCase()} size="sm" />
              ))}
            </View>
            <AppText variant="caption" color={colors.textMuted}>
              {summary.data.cardCount} cards · changes reflect market movement of cards you hold now
            </AppText>
          </>
        ) : (
          <SkeletonBlock height={48} width={200} />
        )}
      </Surface>

      <Surface style={styles.gap}>
        <SectionHeader title="Value by category" />
        {summary.data?.byCategory.map((c) => {
          const share = total > 0 ? c.valueCents / total : 0;
          return (
            <View key={c.category} style={styles.categoryRow}>
              <View style={styles.categoryLabel}>
                <AppText variant="bodyStrong">{CATEGORY_LABELS[c.category]}</AppText>
                <AppText variant="bodyStrong">{formatCents(c.valueCents)}</AppText>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { width: `${Math.max(share * 100, c.valueCents > 0 ? 2 : 0)}%`, backgroundColor: categoryColors[c.category].main }]} />
              </View>
              <AppText variant="caption" color={colors.textMuted}>
                {c.cardCount} cards · {(share * 100).toFixed(0)}%
              </AppText>
            </View>
          );
        })}
      </Surface>

      <Surface style={styles.gap}>
        <SectionHeader title="Collection value over time" />
        <Segmented options={VALUE_RANGES.map((r) => ({ value: r, label: VALUE_RANGE_LABELS[r] }))} value={range} onChange={setRange} />
        {history.data ? <LineChart points={history.data.points} height={200} /> : <SkeletonBlock height={200} />}
      </Surface>

      <View style={styles.gap}>
        <SectionHeader title="Biggest movers" />
        <Segmented options={WINDOWS} value={moverWindow} onChange={setMoverWindow} />
        <AppText variant="label" color={colors.positive}>
          Gainers
        </AppText>
        {gainers.data?.length ? gainers.data.map(renderMover) : <AppText color={colors.textMuted}>No price increases in this period.</AppText>}
        <AppText variant="label" color={colors.negative}>
          Decliners
        </AppText>
        {losers.data?.length ? losers.data.map(renderMover) : <AppText color={colors.textMuted}>No price decreases in this period.</AppText>}
      </View>

      <View style={styles.gap}>
        <SectionHeader title="Most valuable" />
        {top.data?.map((item) => (
          <CardRow
            key={item.id}
            name={item.card.name}
            subtitle={cardSubtitle(item.card)}
            tierLabel={item.tierLabel}
            category={item.card.category}
            imageUrl={item.imageUrl}
            valueCents={item.totalValueCents}
            quantity={item.quantity}
            onPress={() => navigation.navigate('CardDetails', { itemId: item.id })}
          />
        ))}
      </View>
      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryRow: { gap: 6, paddingVertical: spacing.xs },
  categoryLabel: { flexDirection: 'row', justifyContent: 'space-between' },
  barTrack: { height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  bar: { height: 10, borderRadius: radius.pill },
});
