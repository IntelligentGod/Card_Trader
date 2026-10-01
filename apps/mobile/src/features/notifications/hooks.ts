import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationData, NotificationType } from '@card-trader/shared';
import { api } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import type { RootStackParamList } from '../../navigation/types';

/** In-app notifications (no push yet): the badge polls while the app is open. */
export const UNREAD_POLL_MS = 30_000;

export const useUnreadCount = () =>
  useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: api.notifications.unreadCount,
    refetchInterval: UNREAD_POLL_MS,
  });

export const useNotifications = () =>
  useInfiniteQuery({
    queryKey: queryKeys.notificationList,
    queryFn: ({ pageParam }) => api.notifications.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export function useMarkNotificationsRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => api.notifications.markRead(ids),
    onSuccess: (unread) => {
      client.setQueryData(queryKeys.unreadCount, unread);
      void client.invalidateQueries({ queryKey: queryKeys.notificationList });
    },
  });
}

type Route = { [K in keyof RootStackParamList]: [K, RootStackParamList[K]] }[keyof RootStackParamList];

/** Where tapping a notification goes: the trade, the event (or its vendor list), or a profile. */
export function notificationTarget(type: NotificationType, data: NotificationData): Route | null {
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
