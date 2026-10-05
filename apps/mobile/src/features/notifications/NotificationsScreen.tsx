import { useEffect } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import type { NotificationResponse } from '@card-trader/shared';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { SkeletonList } from '../../components/Skeleton';
import { EmptyState, ErrorState } from '../../components/States';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootScreenProps, RootStackParamList } from '../../navigation/types';
import { spacing, useTheme } from '../../theme';
import {
  notificationTarget,
  RECENT_NOTIFICATIONS,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useRecentNotifications,
  useUnreadCount,
} from './hooks';
import { NotificationRow } from './NotificationRow';

type Navigation = Pick<NativeStackNavigationProp<RootStackParamList>, 'navigate' | 'setOptions'>;

/** Opening a notification marks it read, then goes to what it's about (if anything). */
export function useOpenNotification(navigation: Navigation) {
  const markRead = useMarkNotificationRead();
  return (notification: NotificationResponse) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    const target = notificationTarget(notification.type, notification.data);
    if (target) navigation.navigate(...target);
  };
}

/** "Mark all as read" in the header while anything is unread. */
export function useMarkAllHeader(navigation: Navigation) {
  const { colors } = useTheme();
  const unread = useUnreadCount().data?.count ?? 0;
  const markAll = useMarkAllNotificationsRead();
  const { mutate, isPending } = markAll;
  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        unread > 0 ? (
          <Pressable onPress={() => mutate()} disabled={isPending} hitSlop={8} accessibilityRole="button" testID="mark-all-read">
            <AppText variant="bodyStrong" color={colors.primary}>
              Mark all as read
            </AppText>
          </Pressable>
        ) : null,
    });
  }, [navigation, unread, mutate, isPending]);
}

/** The latest few notifications; the full list is one tap away. */
export function NotificationsScreen({ navigation }: RootScreenProps<'Notifications'>) {
  const { colors } = useTheme();
  const recent = useRecentNotifications();
  const open = useOpenNotification(navigation);
  useMarkAllHeader(navigation);

  if (recent.isPending) return <SkeletonList rows={RECENT_NOTIFICATIONS} />;
  if (recent.error) return <ErrorState error={recent.error} onRetry={() => void recent.refetch()} />;

  const items = recent.data.data.slice(0, RECENT_NOTIFICATIONS);
  const hasMore = recent.data.nextCursor !== null;

  return (
    <FlatList
      data={items}
      keyExtractor={(n) => n.id}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={Separator}
      refreshControl={<RefreshControl refreshing={recent.isRefetching} onRefresh={() => void recent.refetch()} tintColor={colors.primary} />}
      ListEmptyComponent={
        <EmptyState
          icon="notifications-outline"
          title="You're all caught up"
          message="Trade offers, reviews, vendor decisions, show updates and account notices will appear here."
        />
      }
      ListFooterComponent={
        hasMore ? (
          <Button
            title="Show all"
            variant="secondary"
            icon="time-outline"
            testID="notifications-show-all"
            style={styles.showAll}
            onPress={() => navigation.navigate('NotificationHistory')}
          />
        ) : null
      }
      renderItem={({ item }) => <NotificationRow notification={item} onPress={() => open(item)} />}
    />
  );
}

export function Separator() {
  return <View style={{ height: spacing.sm }} />;
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, flexGrow: 1 },
  showAll: { marginTop: spacing.lg },
});
