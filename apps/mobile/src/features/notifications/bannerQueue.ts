import type { NotificationResponse } from '@card-trader/shared';

/** One banner on screen, the rest waiting in arrival order. */
export interface BannerQueue {
  current: NotificationResponse | null;
  waiting: NotificationResponse[];
}

export const EMPTY_BANNER_QUEUE: BannerQueue = { current: null, waiting: [] };
/** Beyond this, the oldest waiting banners are dropped (the Notifications screen still lists them). */
export const MAX_WAITING_BANNERS = 3;
export const BANNER_DURATION_MS = 5_000;

/** Adds a notification unless it's already showing or queued. */
export function enqueueBanner(queue: BannerQueue, notification: NotificationResponse, max = MAX_WAITING_BANNERS): BannerQueue {
  if (queue.current?.id === notification.id || queue.waiting.some((n) => n.id === notification.id)) return queue;
  if (!queue.current) return { current: notification, waiting: queue.waiting };
  return { current: queue.current, waiting: [...queue.waiting, notification].slice(-max) };
}

/** The current banner was dismissed (or timed out): show the next one. */
export function advanceBanner(queue: BannerQueue): BannerQueue {
  const [next = null, ...rest] = queue.waiting;
  return { current: next, waiting: rest };
}
