import type { NotificationResponse } from '@card-trader/shared';

type Listener = (notification: NotificationResponse) => void;

const listeners = new Set<Listener>();

/**
 * "A new notification arrived." Today the unread-count poller in phoneAlerts
 * calls emitNotification; a WebSocket or push transport can call it later and
 * the in-app banner, phone alert and badge sync keep working unchanged.
 */
export function emitNotification(notification: NotificationResponse): void {
  for (const listener of listeners) {
    try {
      listener(notification);
    } catch {
      // One broken listener must not stop the others.
    }
  }
}

/** Returns the unsubscribe function (fits a useEffect cleanup). */
export function subscribeNotifications(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
