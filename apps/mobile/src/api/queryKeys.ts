import type { MoverWindow, ValueRange } from '@card-trader/shared';
import type { EventSearchQuery } from '@card-trader/shared';
import type { CollectionFilters, EventListFilters, PublicCollectionFilters } from './endpoints';

/** Central query keys so invalidation stays consistent. */
export const queryKeys = {
  me: ['me'] as const,
  qr: ['me', 'qr'] as const,

  portfolio: ['portfolio'] as const,
  portfolioSummary: ['portfolio', 'summary'] as const,
  portfolioHistory: (range: ValueRange) => ['portfolio', 'history', range] as const,
  portfolioTop: ['portfolio', 'top'] as const,
  portfolioMovers: (direction: 'up' | 'down', window: MoverWindow) => ['portfolio', 'movers', direction, window] as const,

  collection: ['collection'] as const,
  collectionList: (filters: CollectionFilters) => ['collection', 'list', filters] as const,
  collectionItem: (id: string) => ['collection', 'item', id] as const,
  collectionHistory: (id: string, range: ValueRange) => ['collection', 'history', id, range] as const,
  collectionMarket: (id: string) => ['collection', 'market', id] as const,

  cardSearch: (q: string, category: string | undefined) => ['cards', 'search', q, category ?? 'ALL'] as const,
  sets: (category: string | undefined, q: string) => ['sets', category ?? 'ALL', q] as const,

  user: (publicId: string) => ['users', publicId] as const,
  userCollection: (publicId: string, filters: PublicCollectionFilters) => ['users', publicId, 'collection', filters] as const,
  userReviews: (publicId: string) => ['users', publicId, 'reviews'] as const,

  trades: ['trades'] as const,
  tradeList: (scope: 'active' | 'history') => ['trades', 'list', scope] as const,
  trade: (id: string) => ['trades', 'detail', id] as const,

  events: ['events'] as const,
  eventList: (filters: EventListFilters) => ['events', 'list', filters] as const,
  event: (id: string) => ['events', 'detail', id] as const,
  eventApplications: (id: string) => ['events', 'detail', id, 'applications'] as const,
  eventMyInventory: (id: string) => ['events', 'detail', id, 'my-inventory'] as const,
  eventSearch: (id: string, filters: EventSearchQuery) => ['events', 'detail', id, 'search', filters] as const,

  notifications: ['notifications'] as const,
  notificationList: ['notifications', 'list'] as const,
  unreadCount: ['notifications', 'unread'] as const,
};
