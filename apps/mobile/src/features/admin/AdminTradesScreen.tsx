import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { TRADE_STATUS_LABELS, TRADE_STATUSES, type TradeStatus } from '@card-trader/shared';
import { ChipRow } from '../../components/Controls';
import { SkeletonList } from '../../components/Skeleton';
import { EmptyState, ErrorState } from '../../components/States';
import type { RootScreenProps } from '../../navigation/types';
import { colors, spacing } from '../../theme';
import { AdminTradeRow, TRADE_STATUS_COLOR } from './components';
import { useAdminTradeList } from './hooks';

const STATUS_OPTIONS = TRADE_STATUSES.map((s) => ({ value: s, label: TRADE_STATUS_LABELS[s], color: TRADE_STATUS_COLOR[s] }));

export function AdminTradesScreen({ navigation }: RootScreenProps<'AdminTrades'>) {
  const [status, setStatus] = useState<TradeStatus | undefined>();
  const list = useAdminTradeList({ status });
  const trades = list.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ChipRow options={STATUS_OPTIONS} value={status} onChange={setStatus} allowNone="All" />
      </View>

      {list.isPending ? (
        <SkeletonList rows={4} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <FlatList
          data={trades}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => <AdminTradeRow trade={item} onPress={() => navigation.navigate('AdminTrade', { tradeId: item.id })} />}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
          }}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.primary} />}
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon="swap-horizontal"
              title={status ? `No ${TRADE_STATUS_LABELS[status].toLowerCase()} trades` : 'No trades yet'}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  list: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl, flexGrow: 1 },
});
