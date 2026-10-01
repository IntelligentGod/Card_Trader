import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import type { NotificationData, NotificationResponse, NotificationType, Paginated } from '@card-trader/shared';
import { api } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import type { RootStackParamList } from '../../navigation/types';

/** In-app notifications (no push yet): the badge polls, also in the background so phoneAlerts can ring. */
export const UNREAD_POLL_MS = 30_000;
/** How many the Notifications screen shows before "Show all". */
export const RECENT_NOTIFICATIONS = 6;

export const useUnreadCount = () =>
  useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: api.notifications.unreadCount,
    refetchInterval: UNREAD_POLL_MS,
    refetchIntervalInBackground: true,
  });

/** Latest few (plain query; its key differs from the infinite history's). */
export const useRecentNotifications = () =>
  useQuery({
    queryKey: queryKeys.notificationRecent,
    queryFn: () => api.notifications.recent(RECENT_NOTIFICATIONS),
  });

export const useNotificationHistory = () =>
  useInfiniteQuery({
    queryKey: queryKeys.notificationHistory,
    queryFn: ({ pageParam }) => api.notifications.history(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** Marks rows read in both cached lists right away, so the UI doesn't wait for the refetch. */
function markCachedRead(client: QueryClient, id: string | null): void {
  const now = new Date().toISOString();
  const patch = (n: NotificationResponse) => (id === null || n.id === id) && !n.isRead ? { ...n, isRead: true, readAt: now } : n;
  client.setQueryData<Paginated<NotificationResponse>>(queryKeys.notificationRecent, (page) =>
    page ? { ...page, data: page.data.map(patch) } : page,
  );
  client.setQueryData<InfiniteData<Paginated<NotificationResponse>>>(queryKeys.notificationHistory, (data) =>
    data ? { ...data, pages: data.pages.map((page) => ({ ...page, data: page.data.map(patch) })) } : data,
  );
}

/** Keeps the badge and both lists in sync after a read action (also used outside React, e.g. by the banner). */
export function syncAfterRead(client: QueryClient, id: string | null, unread: { count: number }): void {
  markCachedRead(client, id);
  client.setQueryData(queryKeys.unreadCount, unread);
  void client.invalidateQueries({ queryKey: queryKeys.notificationRecent });
  void client.invalidateQueries({ queryKey: queryKeys.notificationHistory });
}

export function useMarkNotificationRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.notifications.markOneRead(id),
    onSuccess: (unread, id) => syncAfterRead(client, id, unread),
  });
}

export function useMarkAllNotificationsRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.notifications.markAllRead,
    onSuccess: (unread) => syncAfterRead(client, null, unread),
  });
}

type Route = { [K in keyof RootStackParamList]: [K, RootStackParamList[K]] }[keyof RootStackParamList];

/** Where tapping a notification goes: the trade, the event (or its vendor list), or a profile. */
export function notificationTarget(type: NotificationType, data: NotificationData): Route | null {
  // Announcements and security notices are read in place; there's nothing to open.
  if (type === 'ANNOUNCEMENT' || type === 'ACCOUNT_SECURITY') return null;
  if (data.tradeId) {
    // Changed terms are a draft being edited; everything else is an offer to review.
    return type === 'TRADE_TERMS_CHANGED' ? ['TradeBuilder', { tradeId: data.tradeId }] : ['TradeConfirmation', { tradeId: data.tradeId }];
  }
  if (data.eventId) {
    if (type === 'VENDOR_APPLICATION') return ['EventVendors', { eventId: data.eventId }];
    return ['EventDetails', { eventId: data.eventId }];
  }
  if (data.publicId) return ['OtherUserProfile', { publicId: data.publicId }];
  return null;
}

/** Unread notifications created after `since`, oldest first. */
export function newSince(items: NotificationResponse[], since: string): NotificationResponse[] {
  return items.filter((n) => !n.isRead && n.readAt === null && n.createdAt > since).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
