import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { errorMessage } from '../../../api/client';
import { api } from '../../../api/endpoints';
import { queryKeys } from '../../../api/queryKeys';
import { AppText } from '../../../components/AppText';
import { CardRow } from '../../../components/CardRow';
import { TextField } from '../../../components/Controls';
import { SkeletonList } from '../../../components/Skeleton';
import { EmptyState, ErrorState } from '../../../components/States';
import { ScreenBackground } from '../../../components/ScreenBackground';
import type { RootScreenProps } from '../../../navigation/types';
import { makeStyles, spacing, useTheme } from '../../../theme';
import { cardSubtitle } from '../../../utils/format';
import { useTrade, useTradeAction } from '../hooks';

interface PickableItem {
  id: string;
  name: string;
  subtitle: string;
  tierLabel: string;
  category: Parameters<typeof CardRow>[0]['category'];
  imageUrl: string | null;
  valueCents: number | null;
  quantity: number;
}

/** Adds cards to one side of a trade: my whole collection, or their tradeable cards. */
export function TradeAddCardsScreen({ route }: RootScreenProps<'TradeAddCards'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tradeId, side, publicId } = route.params;
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim()) || undefined;
  const trade = useTrade(tradeId);
  const add = useTradeAction(tradeId, (collectionItemId: string) => api.trades.addItem(tradeId, { collectionItemId }));

  const list = useInfiniteQuery({
    // Own key: this query caches a mapped shape, so it must not share the collection list's cache entry.
    queryKey: [...queryKeys.trades, 'picker', side, side === 'mine' ? 'me' : publicId, q ?? ''],
    queryFn: async ({ pageParam }): Promise<{ data: PickableItem[]; nextCursor: string | null }> => {
      if (side === 'mine') {
        const page = await api.collection.list({ q, sort: 'value_desc' }, pageParam);
        return {
          nextCursor: page.nextCursor,
          data: page.data
            .filter((i) => !i.lockedInTrade)
            .map((i) => ({
              id: i.id,
              name: i.card.name,
              subtitle: cardSubtitle(i.card),
              tierLabel: i.tierLabel,
              category: i.card.category,
              imageUrl: i.imageUrl,
              valueCents: i.estimatedValueCents,
              quantity: i.quantity,
            })),
        };
      }
      const page = await api.users.publicCollection(publicId, { q, sort: 'value_desc' }, pageParam);
      return {
        nextCursor: page.nextCursor,
        data: page.data.map((i) => ({
          id: i.id,
          name: i.card.name,
          subtitle: cardSubtitle(i.card),
          tierLabel: i.tierLabel,
          category: i.card.category,
          imageUrl: i.imageUrl,
          valueCents: i.estimatedValueCents,
          quantity: i.quantity,
        })),
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const inTrade = new Set(
    [...(trade.data?.initiator.items ?? []), ...(trade.data?.counterparty.items ?? [])].map((i) => i.collectionItemId),
  );
  const items = list.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <View style={styles.container}>
      <ScreenBackground />
      <View style={styles.header}>
        <TextField placeholder="Search cards" value={search} onChangeText={setSearch} />
        {add.error ? <AppText color={colors.negative}>{errorMessage(add.error)}</AppText> : null}
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
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon="albums-outline"
              title={side === 'mine' ? 'No cards available' : 'No cards for trade'}
              message={side === 'mine' ? 'Add cards to your collection first.' : 'They haven’t marked any cards as available for trade.'}
            />
          }
          renderItem={({ item }) => {
            const added = inTrade.has(item.id);
            const adding = add.isPending && add.variables === item.id;
            return (
              <CardRow
                {...item}
                selected={added}
                onPress={added || add.isPending ? undefined : () => add.mutate(item.id)}
                trailing={
                  adding ? (
                    <ActivityIndicator />
                  ) : (
                    <Ionicons name={added ? 'checkmark-circle' : 'add-circle-outline'} size={22} color={added ? colors.primary : colors.textSubtle} />
                  )
                }
              />
            );
          }}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, gap: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
}));
