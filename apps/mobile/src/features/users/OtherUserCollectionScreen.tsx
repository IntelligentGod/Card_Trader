import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useDeferredValue, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import {
  CARD_CATEGORIES,
  CATEGORY_LABELS,
  formatCents,
  type CardCategory,
  type CollectionSort,
  type PublicCollectionItem,
} from '@card-trader/shared';
import { errorMessage } from '../../api/client';
import { api } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { CardRow } from '../../components/CardRow';
import { ChipRow, Segmented, TextField } from '../../components/Controls';
import { ListingBadge } from '../../components/ListingBadge';
import { SkeletonList } from '../../components/Skeleton';
import { EmptyState, ErrorState } from '../../components/States';
import type { RootScreenProps } from '../../navigation/types';
import { makeStyles, spacing, useTheme } from '../../theme';
import { cardSubtitle } from '../../utils/format';
import { useStartTrade } from '../trades/useStartTrade';

type Availability = 'all' | 'trade' | 'sale';
const AVAILABILITY: { value: Availability; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'trade', label: 'For trade' },
  { value: 'sale', label: 'For sale' },
];

const SORTS: { value: CollectionSort; label: string }[] = [
  { value: 'value_desc', label: 'Value ↓' },
  { value: 'value_asc', label: 'Value ↑' },
  { value: 'name', label: 'Name' },
  { value: 'newest', label: 'Newest' },
];

export function OtherUserCollectionScreen({ route, navigation }: RootScreenProps<'OtherUserCollection'>) {
  const styles = useStyles();
  const { categoryColors, colors } = useTheme();
  const { publicId } = route.params;
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const [category, setCategory] = useState<CardCategory | undefined>();
  const [sort, setSort] = useState<CollectionSort>('value_desc');
  const [availability, setAvailability] = useState<Availability>('all');
  const [selected, setSelected] = useState<Map<string, PublicCollectionItem>>(new Map());
  const startTrade = useStartTrade();

  const filters = { q: q || undefined, category, sort, availability: availability === 'all' ? undefined : availability };
  const list = useInfiniteQuery({
    queryKey: queryKeys.userCollection(publicId, filters),
    queryFn: ({ pageParam }) => api.users.publicCollection(publicId, filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = list.data?.pages.flatMap((p) => p.data) ?? [];

  // Everything shown is listed for trade and/or sale; buying is a trade with cash.
  const toggle = useCallback((item: PublicCollectionItem) => {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  }, []);

  const selectedTotal = [...selected.values()].reduce((sum, i) => sum + (i.estimatedValueCents ?? 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TextField placeholder="Search their cards" value={search} onChangeText={setSearch} />
        <ChipRow
          options={CARD_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c], color: categoryColors[c].main }))}
          value={category}
          onChange={setCategory}
          allowNone="All"
        />
        <Segmented options={AVAILABILITY} value={availability} onChange={setAvailability} />
        <ChipRow options={SORTS} value={sort} onChange={(v) => setSort(v ?? 'value_desc')} />
      </View>

      {list.isPending ? (
        <SkeletonList />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
          }}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null}
          ListEmptyComponent={
            <EmptyState icon="eye-off-outline" title="Nothing to show" message="This collector has no cards for trade or sale matching these filters." />
          }
          renderItem={({ item }) => (
            <CardRow
              name={item.card.name}
              subtitle={cardSubtitle(item.card)}
              tierLabel={item.tierLabel}
              category={item.card.category}
              imageUrl={item.imageUrl}
              valueCents={item.estimatedValueCents}
              quantity={item.quantity}
              selected={selected.has(item.id)}
              onPress={() => toggle(item)}
              trailing={
                <View style={styles.trailing}>
                  <ListingBadge status={item.listingStatus} askingPriceCents={item.askingPriceCents} />
                  <Ionicons
                    name={selected.has(item.id) ? 'checkmark-circle' : 'add-circle-outline'}
                    size={22}
                    color={selected.has(item.id) ? colors.primary : colors.textSubtle}
                  />
                </View>
              }
            />
          )}
        />
      )}

      {selected.size > 0 ? (
        <View style={styles.footer}>
          <AppText color={colors.textMuted}>
            {selected.size} selected · {formatCents(selectedTotal)}
          </AppText>
          {startTrade.error ? <AppText color={colors.negative}>{errorMessage(startTrade.error)}</AppText> : null}
          <Button
            title="Start trade with these cards"
            icon="swap-horizontal"
            loading={startTrade.isPending}
            onPress={() =>
              startTrade.mutate(
                { publicId, collectionItemIds: [...selected.keys()], eventId: route.params.eventId },
                { onSuccess: (trade) => navigation.navigate('TradeBuilder', { tradeId: trade.id }) },
              )
            }
          />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, gap: spacing.sm },
  trailing: { alignItems: 'flex-end', gap: spacing.xs },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  footer: { padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
}));
