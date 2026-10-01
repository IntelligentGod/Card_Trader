import type { AdminAuditQuery, AdminCardListQuery, AdminTradeListQuery, AdminUserListQuery, MoverWindow, ValueRange } from '@card-trader/shared';
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
  /** First page only (useQuery). Kept apart from eventList, which holds useInfiniteQuery pages. */
  eventListFirstPage: (filters: EventListFilters) => ['events', 'list', 'first-page', filters] as const,
  event: (id: string) => ['events', 'detail', id] as const,
  eventApplications: (id: string) => ['events', 'detail', id, 'applications'] as const,
  eventMyInventory: (id: string) => ['events', 'detail', id, 'my-inventory'] as const,
  eventSearch: (id: string, filters: EventSearchQuery) => ['events', 'detail', id, 'search', filters] as const,

  notifications: ['notifications'] as const,
  /** latest 6 (useQuery) — kept apart from notificationHistory, which holds useInfiniteQuery pages */
  notificationRecent: ['notifications', 'recent'] as const,
  notificationHistory: ['notifications', 'history'] as const,
  unreadCount: ['notifications', 'unread'] as const,

  // Admin console: own prefix, and one key per query so plain and infinite queries never share an entry.
  admin: ['admin'] as const,
  adminOverview: ['admin', 'overview'] as const,
  adminUserList: (filters: AdminUserListQuery) => ['admin', 'users', 'list', filters] as const,
  adminUser: (publicId: string) => ['admin', 'users', 'detail', publicId] as const,
  adminUserCollection: (publicId: string) => ['admin', 'users', 'detail', publicId, 'collection'] as const,
  adminUserTrades: (publicId: string) => ['admin', 'users', 'detail', publicId, 'trades'] as const,
  adminUserReviews: (publicId: string) => ['admin', 'users', 'detail', publicId, 'reviews'] as const,
  adminTradeList: (filters: AdminTradeListQuery) => ['admin', 'trades', 'list', filters] as const,
  adminTrade: (id: string) => ['admin', 'trades', 'detail', id] as const,
  adminUserHistory: (publicId: string) => ['admin', 'users', 'detail', publicId, 'history'] as const,
  adminCards: ['admin', 'cards'] as const,
  adminCardList: (filters: AdminCardListQuery) => ['admin', 'cards', 'list', filters] as const,
  adminCard: (id: string) => ['admin', 'cards', 'detail', id] as const,
  adminAnalytics: ['admin', 'analytics'] as const,
  adminAudit: ['admin', 'audit'] as const,
  adminAuditList: (filters: AdminAuditQuery) => ['admin', 'audit', 'list', filters] as const,
};
