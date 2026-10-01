import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import type { NotificationResponse, NotificationType } from '@card-trader/shared';
import { AppText } from '../../components/AppText';
import { SkeletonList } from '../../components/Skeleton';
import { EmptyState, ErrorState } from '../../components/States';
import type { RootScreenProps } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme';
import { formatRelative } from '../../utils/format';
import { notificationTarget, useMarkNotificationsRead, useNotifications } from './hooks';

const ICONS: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  TRADE_OFFER: 'swap-horizontal',
  TRADE_COUNTER: 'git-compare',
  TRADE_ACCEPTED: 'checkmark-circle',
  TRADE_DECLINED: 'close-circle',
  TRADE_CANCELLED: 'close-circle-outline',
  TRADE_TERMS_CHANGED: 'create',
  TRADE_COMPLETED: 'trophy',
  REVIEW_RECEIVED: 'star',
  VENDOR_APPLICATION: 'storefront',
  VENDOR_APPROVED: 'storefront',
  VENDOR_DECLINED: 'storefront-outline',
  EVENT_UPDATED: 'calendar',
  EVENT_CANCELLED: 'calendar-clear',
  EVENT_REMINDER: 'alarm',
};

export function NotificationsScreen({ navigation }: RootScreenProps<'Notifications'>) {
  const list = useNotifications();
  const markRead = useMarkNotificationsRead();
  const items = list.data?.pages.flatMap((p) => p.data) ?? [];
  const hasUnread = items.some((n) => n.readAt === null);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        hasUnread ? (
          <Pressable onPress={() => markRead.mutate(undefined)} hitSlop={8}>
            <AppText variant="bodyStrong" color={colors.primary}>
              Mark all read
            </AppText>
          </Pressable>
        ) : null,
    });
  }, [navigation, hasUnread, markRead]);

  const open = (notification: NotificationResponse) => {
    if (notification.readAt === null) markRead.mutate([notification.id]);
    const target = notificationTarget(notification.type, notification.data);
    if (target) navigation.navigate(...target);
  };

  if (list.isPending) return <SkeletonList rows={6} />;
  if (list.error) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;

  return (
    <FlatList
      data={items}
      keyExtractor={(n) => n.id}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
      }}
      refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.primary} />}
      ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null}
      ListEmptyComponent={
        <EmptyState
          icon="notifications-outline"
          title="You're all caught up"
          message="Trade offers, reviews, vendor decisions and show updates will appear here."
        />
      }
      renderItem={({ item }) => {
        const unread = item.readAt === null;
        return (
          <Pressable
            onPress={() => open(item)}
            style={({ pressed }) => [styles.row, unread && styles.unread, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ selected: unread }}
          >
            <View style={[styles.icon, unread && styles.iconUnread]}>
              <Ionicons name={ICONS[item.type]} size={20} color={unread ? colors.white : colors.primary} />
            </View>
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                  {item.title}
                </AppText>
                <AppText variant="caption" color={colors.textSubtle}>
                  {formatRelative(item.createdAt)}
                </AppText>
              </View>
              <AppText color={colors.textMuted}>{item.body}</AppText>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, flexGrow: 1 },
  row: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
  unread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  pressed: { opacity: 0.85 },
  icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  iconUnread: { backgroundColor: colors.primary },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
