import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  CARD_CATEGORIES,
  CATEGORY_LABELS,
  formatCents,
  GRADING_COMPANIES,
  LISTING_STATUS_LABELS,
  LISTING_STATUSES,
  TRADE_STATUS_LABELS,
  TRADE_STATUSES,
  type AdminAnalytics,
  type CardCategory,
  type GradingCompany,
} from '@card-trader/shared';
import { AppText } from '../../components/AppText';
import { Screen } from '../../components/Screen';
import { SkeletonBlock } from '../../components/Skeleton';
import { ErrorState } from '../../components/States';
import { Surface } from '../../components/Surface';
import type { RootScreenProps } from '../../navigation/types';
import { makeStyles, spacing, useTheme } from '../../theme';
import { CATALOG_SOURCE_LABELS, formatTimestamp, USER_STATUS_LABELS } from './adminText';
import {
  CATEGORY_SLOT,
  chartData,
  GRADER_SLOT,
  LISTING_SLOT,
  slotColor,
  SOURCE_SLOT,
  TRADE_STATUS_SLOT,
} from './chartGeometry';
import { BarChart, MeterTile, PieChart } from './charts';
import { StatTile } from './components';
import { useAdminAnalytics } from './hooks';

const SOURCES = ['SEED', 'IMPORT', 'USER_SUBMITTED'] as const;
const GRADER_LABELS: Record<GradingCompany, string> = { PSA: 'PSA', BGS: 'BGS', CGC: 'CGC', OTHER: 'Other' };
const money = (cents: number) => formatCents(cents);

function Section({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <AppText variant="heading">{title}</AppText>
      {children}
    </View>
  );
}

export function AdminAnalyticsScreen({ navigation }: RootScreenProps<'AdminAnalytics'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const analytics = useAdminAnalytics();

  if (analytics.isPending) {
    return (
      <Screen>
        <SkeletonBlock height={120} />
        <SkeletonBlock height={280} />
        <SkeletonBlock height={200} />
      </Screen>
    );
  }
  if (analytics.error) return <ErrorState error={analytics.error} onRetry={() => void analytics.refetch()} />;
  const a: AdminAnalytics = analytics.data;

  const valueByCategory = Object.fromEntries(a.collection.byCategory.map((c) => [c.category, c.valueCents])) as Partial<
    Record<CardCategory, number>
  >;

  return (
    <Screen refreshing={analytics.isRefetching} onRefresh={() => void analytics.refetch()}>
      <AppText variant="caption" color={colors.textSubtle}>
        Generated {formatTimestamp(a.generatedAt)} · months in UTC
      </AppText>

      <Section title="Users">
        <View style={styles.grid}>
          {(['ACTIVE', 'BLOCKED', 'DISABLED'] as const).map((s) => (
            <StatTile key={s} label={USER_STATUS_LABELS[s]} value={a.users.byStatus[s] ?? 0} />
          ))}
          <StatTile label="Admins" value={a.users.byRole.ADMIN ?? 0} />
          {/* only present for super-admin viewers */}
          {a.users.byRole.SUPER_ADMIN !== undefined ? <StatTile label="Super admins" value={a.users.byRole.SUPER_ADMIN} /> : null}
          <StatTile label="Vendors" value={a.users.vendors} />
        </View>
        <BarChart title="Sign-ups per month" points={a.users.signupsByMonth.map((m) => ({ month: m.month, value: m.count }))} testID="chart-signups" />
      </Section>

      <Section title="Collections">
        <PieChart
          title="Collection value by category"
          data={chartData(valueByCategory, CARD_CATEGORIES, CATEGORY_LABELS, CATEGORY_SLOT)}
          format={money}
          testID="chart-value-category"
        />
        <PieChart
          title="Items by listing status"
          data={chartData(a.collection.byListingStatus, LISTING_STATUSES, LISTING_STATUS_LABELS, LISTING_SLOT)}
          testID="chart-listing"
        />
        <MeterTile
          title="Raw vs graded items"
          left={{ label: 'Raw', value: a.collection.rawItems, color: slotColor(1) }}
          right={{ label: 'Graded', value: a.collection.gradedItems, color: slotColor(2) }}
        />
        <PieChart
          title="Graded items by grader"
          data={chartData(a.collection.byGrader, GRADING_COMPANIES, GRADER_LABELS, GRADER_SLOT)}
          testID="chart-grader"
        />
      </Section>

      <Section title="Catalog">
        <View style={styles.grid}>
          <StatTile label="Cards" value={a.catalog.total} />
          <StatTile label="Verified" value={a.catalog.verified} />
          <StatTile label="Unverified" value={a.catalog.unverified} />
        </View>
        <PieChart title="Catalog by source" data={chartData(a.catalog.bySource, SOURCES, CATALOG_SOURCE_LABELS, SOURCE_SLOT)} testID="chart-source" />
        <PieChart
          title="Catalog by category"
          data={chartData(a.catalog.byCategory, CARD_CATEGORIES, CATEGORY_LABELS, CATEGORY_SLOT)}
          testID="chart-catalog-category"
        />
      </Section>

      <Section title="Trades">
        <PieChart
          title="Trades by status"
          data={chartData(a.trades.byStatus, TRADE_STATUSES, TRADE_STATUS_LABELS, TRADE_STATUS_SLOT)}
          testID="chart-trade-status"
        />
        <View style={styles.grid}>
          <StatTile
            label="Avg completed trade value"
            value={a.trades.averageCompletedValueCents === null ? '—' : formatCents(a.trades.averageCompletedValueCents)}
          />
        </View>
        <BarChart
          title="Completed trades per month"
          points={a.trades.completedByMonth.map((m) => ({ month: m.month, value: m.count }))}
          testID="chart-completed"
        />
        <BarChart
          title="Completed trade value per month"
          points={a.trades.completedByMonth.map((m) => ({ month: m.month, value: m.valueCents }))}
          format={money}
          testID="chart-completed-value"
        />
      </Section>

      <Section title="Top cards by total value">
        <Surface style={styles.table}>
          {a.topCards.length === 0 ? (
            <AppText color={colors.textMuted}>No priced cards in collections yet.</AppText>
          ) : (
            a.topCards.map((card, i) => (
              <Pressable
                key={card.cardId}
                style={({ pressed }) => [styles.topRow, i > 0 && styles.topRowBorder, pressed && styles.pressed]}
                onPress={() => navigation.navigate('AdminCard', { cardId: card.cardId })}
              >
                <AppText variant="bodyStrong" color={colors.textMuted} style={styles.rank}>
                  {i + 1}
                </AppText>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {card.name}
                  </AppText>
                  <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
                    {card.setName} · {CATEGORY_LABELS[card.category]} · {card.copies} {card.copies === 1 ? 'copy' : 'copies'}
                  </AppText>
                </View>
                <AppText variant="bodyStrong">{formatCents(card.valueCents)}</AppText>
              </Pressable>
            ))
          )}
        </Surface>
      </Section>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  section: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  table: { paddingVertical: spacing.xs },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingVertical: spacing.sm },
  topRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { opacity: 0.85 },
  rank: { width: 22 },
  flex: { flex: 1 },
}));
