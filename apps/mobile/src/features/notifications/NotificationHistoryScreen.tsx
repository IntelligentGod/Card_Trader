import { ActivityIndicator, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { SkeletonList } from '../../components/Skeleton';
import { EmptyState, ErrorState } from '../../components/States';
import type { RootScreenProps } from '../../navigation/types';
import { spacing, useTheme } from '../../theme';
import { useNotificationHistory } from './hooks';
import { NotificationRow } from './NotificationRow';
import { Separator, useMarkAllHeader, useOpenNotification } from './NotificationsScreen';

/** Every notification, newest first, loaded 30 at a time. */
export function NotificationHistoryScreen({ navigation }: RootScreenProps<'NotificationHistory'>) {
  const { colors } = useTheme();
  const history = useNotificationHistory();
  const open = useOpenNotification(navigation);
  useMarkAllHeader(navigation);

  if (history.isPending) return <SkeletonList rows={8} />;
  if (history.error) return <ErrorState error={history.error} onRetry={() => void history.refetch()} />;

  const items = history.data.pages.flatMap((p) => p.data);

  return (
    <FlatList
      data={items}
      keyExtractor={(n) => n.id}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={Separator}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (history.hasNextPage && !history.isFetchingNextPage) void history.fetchNextPage();
      }}
      refreshControl={
        <RefreshControl
          refreshing={history.isRefetching && !history.isFetchingNextPage}
          onRefresh={() => void history.refetch()}
          tintColor={colors.primary}
        />
      }
      ListFooterComponent={history.isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null}
      ListEmptyComponent={<EmptyState icon="notifications-outline" title="No notifications yet" />}
      renderItem={({ item }) => <NotificationRow notification={item} onPress={() => open(item)} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, flexGrow: 1 },
});
