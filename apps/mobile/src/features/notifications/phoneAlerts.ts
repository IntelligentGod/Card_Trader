import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import type { NotificationData, NotificationResponse, NotificationType } from '@card-trader/shared';
import { api } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import { navigationRef } from '../../navigation/deepLinks';
import { newSince, notificationTarget, useUnreadCount } from './hooks';
import { emitNotification, subscribeNotifications } from './notificationEvents';

/** Android takes the sound and importance from the channel, not from each notification. */
export const ALERT_CHANNEL_ID = 'alerts';

type AlertPayload = { type: NotificationType; data: NotificationData };

// Ring and show a banner even while the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

/** Creates the ringing channel, then asks once for permission. */
async function prepareAlerts(): Promise<boolean> {
  if (Platform.OS === 'android') {
    // The channel must exist before Android 13+ will show the permission prompt.
    await Notifications.setNotificationChannelAsync(ALERT_CHANNEL_ID, {
      name: 'Trades and events',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !current.canAskAgain) return current.granted;
  return (await Notifications.requestPermissionsAsync()).granted;
}

function latest(items: NotificationResponse[], fallback: string): string {
  return items.reduce((max, n) => (n.createdAt > max ? n.createdAt : max), fallback);
}

async function ring(n: NotificationResponse): Promise<void> {
  const payload: AlertPayload = { type: n.type, data: n.data };
  await Notifications.scheduleNotificationAsync({
    content: { title: n.title, body: n.body, sound: 'default', data: payload },
    trigger: Platform.OS === 'android' ? { channelId: ALERT_CHANNEL_ID } : null,
  });
}

/**
 * Detects new notifications and announces them. The unread badge already
 * polls; when its count goes up, the new items are fetched and emitted
 * (notificationEvents). While the app is open, NotificationBanner shows them
 * in-app; in the background they ring as phone notifications. There is no push
 * service yet, so this works while the app is running, not after Android has
 * closed it — a push/WebSocket transport would just call emitNotification too.
 */
export function useNotificationAlerts() {
  const client = useQueryClient();
  const unread = useUnreadCount().data?.count;
  const allowed = useRef(false);
  const previousCount = useRef<number | undefined>(undefined);
  /** createdAt of the newest notification already shown (or present at sign-in). */
  const lastSeen = useRef<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    prepareAlerts()
      .then((granted) => {
        allowed.current = granted;
      })
      .catch(() => undefined);

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const payload = response.notification.request.content.data as Partial<AlertPayload> | undefined;
      if (!payload?.type || !navigationRef.isReady()) return;
      const target = notificationTarget(payload.type, payload.data ?? {});
      navigationRef.navigate(...(target ?? (['Notifications', undefined] as const)));
    });
    return () => subscription.remove();
  }, []);

  // Every arrival: refresh the badge and lists; ring only when the in-app banner can't be seen.
  useEffect(
    () =>
      subscribeNotifications((n) => {
        void client.invalidateQueries({ queryKey: queryKeys.notifications });
        if (AppState.currentState !== 'active' && allowed.current) void ring(n).catch(() => undefined);
      }),
    [client],
  );

  useEffect(() => {
    if (unread === undefined || busy.current) return;
    const previous = previousCount.current;
    previousCount.current = unread;
    const firstLoad = lastSeen.current === null;
    if (!firstLoad && (previous === undefined || unread <= previous)) return;

    busy.current = true;
    api.notifications
      .history()
      .then((page) => {
        // At sign-in, existing notifications are the baseline; only newer ones ring.
        if (lastSeen.current === null) {
          lastSeen.current = latest(page.data, '');
          return;
        }
        const fresh = newSince(page.data, lastSeen.current);
        lastSeen.current = latest(page.data, lastSeen.current);
        for (const n of fresh) emitNotification(n);
      })
      .catch(() => undefined)
      .finally(() => {
        busy.current = false;
      });
  }, [unread]);
}
