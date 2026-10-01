import { Ionicons } from '@expo/vector-icons';
import { useCallback, useDeferredValue, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CARD_CATEGORIES,
  CATEGORY_LABELS,
  LISTING_STATUS_LABELS,
  LISTING_STATUSES,
  type CardCategory,
  type CollectionItemResponse,
  type CollectionSort,
  type ListingStatus,
} from '@card-trader/shared';
import { AppText } from '../../../components/AppText';
import { CardRow } from '../../../components/CardRow';
import { ChipRow, TextField } from '../../../components/Controls';
import { ListingBadge } from '../../../components/ListingBadge';
import { SkeletonList } from '../../../components/Skeleton';
import { EmptyState, ErrorState } from '../../../components/States';
import type { TabScreenProps } from '../../../navigation/types';
import { categoryColors, colors, radius, shadow, spacing } from '../../../theme';
import { cardSubtitle } from '../../../utils/format';
import { useCollectionList } from '../hooks';

const SORTS: { value: CollectionSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'value_desc', label: 'Value ↓' },
  { value: 'value_asc', label: 'Value ↑' },
  { value: 'name', label: 'Name' },
];

const CATEGORY_OPTIONS = CARD_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c], color: categoryColors[c].main }));
const STATUS_OPTIONS = LISTING_STATUSES.map((s) => ({ value: s, label: LISTING_STATUS_LABELS[s] }));

export function MyCollectionScreen({ navigation }: TabScreenProps<'Inventory'>) {
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const [category, setCategory] = useState<CardCategory | undefined>();
  const [sort, setSort] = useState<CollectionSort>('newest');
  const [listingStatus, setListingStatus] = useState<ListingStatus | undefined>();
  const list = useCollectionList({ q: q || undefined, category, sort, listingStatus });
  const items = list.data?.pages.flatMap((page) => page.data) ?? [];

  const renderItem = useCallback(
    ({ item }: { item: CollectionItemResponse }) => (
      <CardRow
        name={item.card.name}
        subtitle={cardSubtitle(item.card)}
        tierLabel={item.tierLabel}
        category={item.card.category}
        imageUrl={item.imageUrl}
        valueCents={item.totalValueCents}
        quantity={item.quantity}
        trailing={<ListingBadge status={item.listingStatus} askingPriceCents={item.askingPriceCents} />}
        onPress={() => navigation.navigate('CardDetails', { itemId: item.id })}
      />
    ),
    [navigation],
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <AppText variant="title">Inventory</AppText>
        <TextField placeholder="Search your cards" value={search} onChangeText={setSearch} returnKeyType="search" />
        <ChipRow options={CATEGORY_OPTIONS} value={category} onChange={setCategory} allowNone="All" />
        <ChipRow options={STATUS_OPTIONS} value={listingStatus} onChange={setListingStatus} allowNone="Any status" />
        <ChipRow options={SORTS} value={sort} onChange={(value) => setSort(value ?? 'newest')} />
      </View>

      {list.isPending ? (
        <SkeletonList />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.primary} />}
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null}
          ListEmptyComponent={
            q || category || listingStatus ? (
              <EmptyState icon="search" title="No matching cards" message="Try a different search, category or status." />
            ) : (
              <EmptyState
                title="Start your collection"
                message="Add cards to see their market value and trade them at shows."
                actionTitle="Add a card"
                onAction={() => navigation.navigate('AddCard')}
              />
            )
          }
          initialNumToRender={10}
          windowSize={7}
          removeClippedSubviews
        />
      )}

      <Pressable style={styles.fab} onPress={() => navigation.navigate('AddCard')} accessibilityRole="button" accessibilityLabel="Add card">
        <Ionicons name="add" size={28} color={colors.white} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  list: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 100, flexGrow: 1 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
});
