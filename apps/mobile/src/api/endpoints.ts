import type {
  AddTradeItemRequest,
  ApplyAsVendorRequest,
  ApproveVendorRequest,
  AuthResponse,
  CardCategory,
  CardSetSummary,
  CardSummary,
  CardValueHistoryResponse,
  CollectionItemResponse,
  CollectionSort,
  CreateCardRequest,
  CreateCollectionItemRequest,
  CreateEventRequest,
  CreateReviewRequest,
  EventDetail,
  EventInventorySelection,
  EventListScope,
  EventSearchQuery,
  EventSearchResult,
  EventSummary,
  EventVendorResponse,
  ListingStatus,
  LoginRequest,
  MarketValueResponse,
  MeResponse,
  Mover,
  NotificationResponse,
  MoverWindow,
  Paginated,
  PortfolioSummary,
  PortfolioValueHistory,
  PublicCollectionItem,
  PublicProfile,
  QrPayload,
  RegisterRequest,
  ReviewResponse,
  SetTradeCashRequest,
  TradeListItem,
  TradeResponse,
  UnreadCountResponse,
  UpdateCollectionItemRequest,
  UpdateEventRequest,
  UpdateMeRequest,
  UpsertVendorProfileRequest,
  UploadPurpose,
  UploadResponse,
  ValueRange,
} from '@card-trader/shared';
import { File } from 'expo-file-system';
import { apiRequest } from './client';

function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export interface CollectionFilters {
  category?: CardCategory;
  listingStatus?: ListingStatus;
  q?: string;
  sort?: CollectionSort;
}

export interface PublicCollectionFilters {
  category?: CardCategory;
  q?: string;
  sort?: CollectionSort;
  /** only cards for trade / for sale; default both */
  availability?: 'trade' | 'sale';
}

export interface EventListFilters {
  scope?: EventListScope;
  q?: string;
  /** public id: shows this vendor is approved for */
  vendor?: string;
}

export const api = {
  auth: {
    register: (body: RegisterRequest) => apiRequest<AuthResponse>('/auth/register', { method: 'POST', body, auth: false }),
    login: (body: LoginRequest) => apiRequest<AuthResponse>('/auth/login', { method: 'POST', body, auth: false }),
    logout: (refreshToken: string) =>
      apiRequest<void>('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }),
  },

  users: {
    me: () => apiRequest<MeResponse>('/users/me'),
    updateMe: (body: UpdateMeRequest) => apiRequest<MeResponse>('/users/me', { method: 'PATCH', body }),
    upsertVendor: (body: UpsertVendorProfileRequest) => apiRequest<MeResponse>('/users/me/vendor', { method: 'PUT', body }),
    qr: () => apiRequest<QrPayload>('/users/me/qr'),
    publicProfile: (publicId: string) => apiRequest<PublicProfile>(`/users/${encodeURIComponent(publicId)}`),
    publicCollection: (publicId: string, filters: PublicCollectionFilters, cursor?: string) =>
      apiRequest<Paginated<PublicCollectionItem>>(
        `/users/${encodeURIComponent(publicId)}/collection${query({ ...filters, cursor, limit: 20 })}`,
      ),
    reviews: (publicId: string, cursor?: string) =>
      apiRequest<Paginated<ReviewResponse>>(`/users/${encodeURIComponent(publicId)}/reviews${query({ cursor, limit: 20 })}`),
  },

  uploads: {
    image: (purpose: UploadPurpose, file: { uri: string; name: string; type: string }) => {
      const form = new FormData();
      // Expo's global fetch (expo/fetch) can't send React Native's { uri, name, type }
      // descriptors; it needs a Blob-like with bytes(), which expo-file-system's File is.
      form.append('file', new File(file.uri), file.name);
      return apiRequest<UploadResponse>(`/uploads/images${query({ purpose })}`, { method: 'POST', form });
    },
  },

  cards: {
    search: (params: { q?: string; category?: CardCategory; cursor?: string }) =>
      apiRequest<Paginated<CardSummary>>(`/cards${query({ ...params, limit: 20 })}`),
    get: (id: string) => apiRequest<CardSummary>(`/cards/${id}`),
    submit: (body: CreateCardRequest) => apiRequest<CardSummary>('/cards', { method: 'POST', body }),
    sets: (params: { category?: CardCategory; q?: string }) => apiRequest<CardSetSummary[]>(`/sets${query(params)}`),
    /** estimate + the 3 most recent comparable sales for a card in one tier */
    marketValue: (cardId: string, tier: string) =>
      apiRequest<MarketValueResponse>(`/cards/${cardId}/market-value${query({ tier })}`),
  },

  collection: {
    list: (filters: CollectionFilters, cursor?: string) =>
      apiRequest<Paginated<CollectionItemResponse>>(`/collection${query({ ...filters, cursor, limit: 20 })}`),
    get: (id: string) => apiRequest<CollectionItemResponse>(`/collection/${id}`),
    create: (body: CreateCollectionItemRequest) => apiRequest<CollectionItemResponse>('/collection', { method: 'POST', body }),
    update: (id: string, body: UpdateCollectionItemRequest) =>
      apiRequest<CollectionItemResponse>(`/collection/${id}`, { method: 'PATCH', body }),
    remove: (id: string) => apiRequest<void>(`/collection/${id}`, { method: 'DELETE' }),
    priceHistory: (id: string, range: ValueRange) =>
      apiRequest<CardValueHistoryResponse>(`/collection/${id}/price-history${query({ range })}`),
    marketValue: (id: string) => apiRequest<MarketValueResponse>(`/collection/${id}/market-value`),
  },

  portfolio: {
    summary: () => apiRequest<PortfolioSummary>('/portfolio/summary'),
    history: (range: ValueRange) => apiRequest<PortfolioValueHistory>(`/portfolio/value-history${query({ range })}`),
    topCards: (limit = 5) => apiRequest<CollectionItemResponse[]>(`/portfolio/top-cards${query({ limit })}`),
    movers: (direction: 'up' | 'down', window: MoverWindow, limit = 5) =>
      apiRequest<Mover[]>(`/portfolio/movers${query({ direction, window, limit })}`),
  },

  trades: {
    list: (scope: 'active' | 'history', cursor?: string) =>
      apiRequest<Paginated<TradeListItem>>(`/trades${query({ scope, cursor, limit: 20 })}`),
    get: (id: string) => apiRequest<TradeResponse>(`/trades/${id}`),
    /** eventId links the trade to the card show it was started from */
    create: (counterpartyPublicId: string, eventId?: string) =>
      apiRequest<TradeResponse>('/trades', { method: 'POST', body: { counterpartyPublicId, eventId } }),
    addItem: (id: string, body: AddTradeItemRequest) =>
      apiRequest<TradeResponse>(`/trades/${id}/items`, { method: 'POST', body }),
    removeItem: (id: string, itemId: string) =>
      apiRequest<TradeResponse>(`/trades/${id}/items/${itemId}`, { method: 'DELETE' }),
    setCash: (id: string, body: SetTradeCashRequest) =>
      apiRequest<TradeResponse>(`/trades/${id}/cash`, { method: 'PUT', body }),
    refreshValues: (id: string) => apiRequest<TradeResponse>(`/trades/${id}/refresh-values`, { method: 'POST' }),
    propose: (id: string, expectedVersion: number) =>
      apiRequest<TradeResponse>(`/trades/${id}/propose`, { method: 'POST', body: { expectedVersion } }),
    accept: (id: string, expectedVersion: number) =>
      apiRequest<TradeResponse>(`/trades/${id}/accept`, { method: 'POST', body: { expectedVersion } }),
    decline: (id: string) => apiRequest<TradeResponse>(`/trades/${id}/decline`, { method: 'POST' }),
    complete: (id: string) => apiRequest<TradeResponse>(`/trades/${id}/complete`, { method: 'POST' }),
    cancel: (id: string) => apiRequest<TradeResponse>(`/trades/${id}/cancel`, { method: 'POST' }),
    review: (id: string, body: CreateReviewRequest) =>
      apiRequest<ReviewResponse>(`/trades/${id}/reviews`, { method: 'POST', body }),
  },

  events: {
    list: (filters: EventListFilters, cursor?: string) =>
      apiRequest<Paginated<EventSummary>>(`/events${query({ ...filters, cursor, limit: 20 })}`),
    get: (id: string) => apiRequest<EventDetail>(`/events/${id}`),
    create: (body: CreateEventRequest) => apiRequest<EventDetail>('/events', { method: 'POST', body }),
    update: (id: string, body: UpdateEventRequest) => apiRequest<EventDetail>(`/events/${id}`, { method: 'PATCH', body }),
    publish: (id: string) => apiRequest<EventDetail>(`/events/${id}/publish`, { method: 'POST' }),
    cancel: (id: string) => apiRequest<EventDetail>(`/events/${id}/cancel`, { method: 'POST' }),
    setSaved: (id: string, saved: boolean) =>
      apiRequest<EventDetail>(`/events/${id}/save`, { method: saved ? 'PUT' : 'DELETE' }),
    applications: (id: string) => apiRequest<EventVendorResponse[]>(`/events/${id}/vendors`),
    apply: (id: string, body: ApplyAsVendorRequest) =>
      apiRequest<EventDetail>(`/events/${id}/vendors/apply`, { method: 'POST', body }),
    withdraw: (id: string) => apiRequest<EventDetail>(`/events/${id}/vendors/me`, { method: 'DELETE' }),
    approve: (id: string, applicationId: string, body: ApproveVendorRequest) =>
      apiRequest<EventVendorResponse>(`/events/${id}/vendors/${applicationId}/approve`, { method: 'POST', body }),
    decline: (id: string, applicationId: string) =>
      apiRequest<EventVendorResponse>(`/events/${id}/vendors/${applicationId}/decline`, { method: 'POST' }),
    myInventory: (id: string) => apiRequest<EventInventorySelection>(`/events/${id}/inventory/me`),
    setMyInventory: (id: string, collectionItemIds: string[]) =>
      apiRequest<EventInventorySelection>(`/events/${id}/inventory/me`, { method: 'PUT', body: { collectionItemIds } }),
    search: (id: string, filters: EventSearchQuery, cursor?: string) =>
      apiRequest<Paginated<EventSearchResult>>(`/events/${id}/search${query({ ...filters, cursor, limit: 20 })}`),
  },

  notifications: {
    list: (cursor?: string) => apiRequest<Paginated<NotificationResponse>>(`/notifications${query({ cursor, limit: 30 })}`),
    unreadCount: () => apiRequest<UnreadCountResponse>('/notifications/unread-count'),
    markRead: (ids?: string[]) => apiRequest<UnreadCountResponse>('/notifications/read', { method: 'POST', body: { ids } }),
  },
};
