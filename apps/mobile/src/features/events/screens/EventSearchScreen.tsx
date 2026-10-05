import { Ionicons } from '@expo/vector-icons';
import { useDeferredValue, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import {
  CARD_CATEGORIES,
  CATEGORY_LABELS,
  CONDITION_LABELS,
  GRADING_COMPANIES,
  isValidGrade,
  parseDollarsToCents,
  type CardCategory,
  type CardCondition,
  type CardKind,
  type EventSearchQuery,
  type GradingCompany,
} from '@card-trader/shared';
import { AppText } from '../../../components/AppText';
import { CardRow } from '../../../components/CardRow';
import { Chip, ChipRow, Segmented, TextField } from '../../../components/Controls';
import { ListingBadge } from '../../../components/ListingBadge';
import { SkeletonList } from '../../../components/Skeleton';
import { EmptyState, ErrorState } from '../../../components/States';
import type { RootScreenProps } from '../../../navigation/types';
import { makeStyles, radius, spacing, useTheme } from '../../../theme';
import { cardSubtitle } from '../../../utils/format';
import { RAW_CONDITION_OPTIONS } from '../../collection/components/CollectionItemForm';
import { useEvent, useEventSearch } from '../hooks';

type KindFilter = 'ANY' | CardKind;

export interface SearchFilterInput {
  q: string;
  set: string;
  year: string;
  category?: CardCategory;
  kind: KindFilter;
  grader?: GradingCompany;
  grade: string;
  condition?: CardCondition;
  minPrice: string;
  maxPrice: string;
  forSale: boolean;
  forTrade: boolean;
}

/** Form state → API query. Invalid numbers are simply left out. Exported for tests. */
export function toSearchQuery(input: SearchFilterInput): EventSearchQuery {
  const year = Number(input.year);
  const grade = Number(input.grade);
  const min = input.minPrice.trim() ? parseDollarsToCents(input.minPrice) : null;
  const max = input.maxPrice.trim() ? parseDollarsToCents(input.maxPrice) : null;
  return {
    ...(input.q.trim() && { q: input.q.trim() }),
    ...(input.set.trim() && { set: input.set.trim() }),
    ...(/^\d{4}$/.test(input.year.trim()) && { year }),
    ...(input.category && { category: input.category }),
    ...(input.kind !== 'ANY' && { kind: input.kind }),
    ...(input.kind === 'GRADED' && input.grader && { grader: input.grader }),
    ...(input.kind === 'GRADED' && input.grade.trim() && isValidGrade(grade) && { grade }),
    ...(input.kind === 'RAW' && input.condition && { condition: input.condition }),
    ...(min !== null && { minPriceCents: min }),
    ...(max !== null && { maxPriceCents: max }),
    ...(input.forSale && { forSale: true }),
    ...(input.forTrade && { forTrade: true }),
  };
}

const KINDS: { value: KindFilter; label: string }[] = [
  { value: 'ANY', label: 'Any' },
  { value: 'RAW', label: 'Raw' },
  { value: 'GRADED', label: 'Graded' },
];

export function EventSearchScreen({ route, navigation }: RootScreenProps<'EventSearch'>) {
  const styles = useStyles();
  const { colors, categoryColors } = useTheme();
  const { eventId } = route.params;
  const event = useEvent(eventId);
  const [showFilters, setShowFilters] = useState(false);
  const [input, setInput] = useState<SearchFilterInput>({
    q: '',
    set: '',
    year: '',
    kind: 'ANY',
    grade: '',
    minPrice: '',
    maxPrice: '',
    forSale: false,
    forTrade: false,
  });
  const deferred = useDeferredValue(input);
  const query = useMemo(() => toSearchQuery(deferred), [deferred]);
  const results = useEventSearch(eventId, query);
  const rows = results.data?.pages.flatMap((p) => p.data) ?? [];
  const set = <K extends keyof SearchFilterInput>(key: K, value: SearchFilterInput[K]) =>
    setInput((current) => ({ ...current, [key]: value }));
  const activeFilterCount = Object.keys(query).filter((k) => k !== 'q').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {event.data ? (
          <AppText variant="caption" color={colors.textMuted}>
            {event.data.title} · {event.data.approvedVendorCount} vendors · {event.data.inventoryCount} cards
          </AppText>
        ) : null}
        <View style={styles.searchRow}>
          <View style={styles.flex}>
            <TextField placeholder="Card, player, number or set" value={input.q} onChangeText={(v) => set('q', v)} returnKeyType="search" />
          </View>
          <Pressable
            style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
            onPress={() => setShowFilters((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Filters"
          >
            <Ionicons name="options-outline" size={20} color={activeFilterCount > 0 ? colors.onPrimary : colors.primary} />
            {activeFilterCount > 0 ? (
              <AppText variant="caption" color={colors.onPrimary} style={styles.bold}>
                {activeFilterCount}
              </AppText>
            ) : null}
          </Pressable>
        </View>
        <View style={styles.toggles}>
          <Chip label="For sale" selected={input.forSale} onPress={() => set('forSale', !input.forSale)} />
          <Chip label="For trade" selected={input.forTrade} onPress={() => set('forTrade', !input.forTrade)} color={colors.positive} />
        </View>

        {showFilters ? (
          <View style={styles.filters}>
            <ChipRow
              options={CARD_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c], color: categoryColors[c].main }))}
              value={input.category}
              onChange={(v) => set('category', v)}
              allowNone="All games"
            />
            <View style={styles.row}>
              <View style={styles.flex}>
                <TextField label="Set" placeholder="e.g. Base Set" value={input.set} onChangeText={(v) => set('set', v)} />
              </View>
              <View style={styles.yearField}>
                <TextField label="Year" placeholder="1999" keyboardType="number-pad" maxLength={4} value={input.year} onChangeText={(v) => set('year', v)} />
              </View>
            </View>
            <Segmented options={KINDS} value={input.kind} onChange={(v) => set('kind', v)} />
            {input.kind === 'GRADED' ? (
              <View style={styles.row}>
                <View style={styles.flex}>
                  <ChipRow options={GRADING_COMPANIES.map((c) => ({ value: c, label: c }))} value={input.grader} onChange={(v) => set('grader', v)} allowNone="Any" />
                </View>
                <View style={styles.yearField}>
                  <TextField placeholder="Grade" keyboardType="decimal-pad" value={input.grade} onChangeText={(v) => set('grade', v)} />
                </View>
              </View>
            ) : null}
            {input.kind === 'RAW' ? (
              <ChipRow
                options={RAW_CONDITION_OPTIONS.filter((c) => c !== 'RAW').map((c) => ({ value: c, label: CONDITION_LABELS[c] }))}
                value={input.condition}
                onChange={(v) => set('condition', v)}
                allowNone="Any condition"
              />
            ) : null}
            <View style={styles.row}>
              <View style={styles.flex}>
                <TextField label="Min $" keyboardType="decimal-pad" value={input.minPrice} onChangeText={(v) => set('minPrice', v)} />
              </View>
              <View style={styles.flex}>
                <TextField label="Max $" keyboardType="decimal-pad" value={input.maxPrice} onChangeText={(v) => set('maxPrice', v)} />
              </View>
            </View>
          </View>
        ) : null}
      </View>

      {results.isPending ? (
        <SkeletonList rows={5} />
      ) : results.error ? (
        <ErrorState error={results.error} onRetry={() => void results.refetch()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          onEndReached={() => {
            if (results.hasNextPage && !results.isFetchingNextPage) void results.fetchNextPage();
          }}
          refreshControl={<RefreshControl refreshing={results.isRefetching} onRefresh={() => void results.refetch()} />}
          ListFooterComponent={results.isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null}
          ListEmptyComponent={
            <EmptyState icon="search" title="Nothing matches" message="Try fewer filters or another card name." />
          }
          renderItem={({ item }) => (
            <CardRow
              name={item.item.card.name}
              subtitle={cardSubtitle(item.item.card)}
              tierLabel={item.item.tierLabel}
              category={item.item.card.category}
              imageUrl={item.item.imageUrl}
              valueCents={item.priceCents}
              quantity={item.item.quantity}
              onPress={() => navigation.navigate('EventListing', { eventId, result: item })}
              footer={
                <View style={styles.vendorLine}>
                  <Ionicons name="storefront-outline" size={12} color={colors.textMuted} />
                  <AppText variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.flex}>
                    {item.vendorInfo?.businessName ?? item.vendor.displayName}
                  </AppText>
                  {item.tableNumber ? (
                    <AppText variant="caption" color={colors.primary} style={styles.bold}>
                      Table {item.tableNumber}
                    </AppText>
                  ) : null}
                </View>
              }
              trailing={
                <View style={styles.trailing}>
                  <AppText variant="caption" color={colors.textSubtle}>
                    {item.priceIsAsking ? 'asking' : 'est. value'}
                  </AppText>
                  <ListingBadge status={item.item.listingStatus} />
                </View>
              }
            />
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  searchRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  filterButtonActive: { backgroundColor: colors.primary },
  toggles: { flexDirection: 'row', gap: spacing.sm },
  filters: { gap: spacing.sm, paddingTop: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end' },
  flex: { flex: 1 },
  yearField: { width: 96 },
  bold: { fontWeight: '700' },
  list: { padding: spacing.lg, paddingTop: spacing.sm, flexGrow: 1 },
  vendorLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  trailing: { alignItems: 'flex-end', gap: 2 },
}));
