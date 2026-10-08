import type {
  AdminAccessRequest,
  BillingStatusResponse,
  AddTradeItemRequest,
  AdminAnalytics,
  AdminAuditEntry,
  AdminAuditQuery,
  AdminBlockRequest,
  AdminBroadcastRequest,
  AdminBroadcastResponse,
  AdminCardDetail,
  AdminCardListItem,
  AdminCardListQuery,
  AdminChangeRoleRequest,
  AdminCreateAdminRequest,
  AdminOverview,
  AdminResetPasswordRequest,
  AdminTradeDetail,
  AdminTradeListItem,
  AdminTradeListQuery,
  AdminUpdateCardRequest,
  AdminUpdateUserRequest,
  AdminUpdateVendorRequest,
  AdminUserDetail,
  AdminUserListItem,
  AdminUserListQuery,
  AdminUserReviews,
  ApplyAsVendorRequest,
  ApproveVendorRequest,
  AppleSignInRequest,
  AuthProviderType,
  AuthResponse,
  ChangePasswordRequest,
  LoginResponse,
  RecoveryCodesResponse,
  TwoFactorProofRequest,
  TwoFactorSetupResponse,
  TwoFactorVerifyRequest,
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
    // Sign-in answers with a session, or with a 2FA challenge to finish via verifyTwoFactor.
    login: (body: LoginRequest) => apiRequest<LoginResponse>('/auth/login', { method: 'POST', body, auth: false }),
    google: (idToken: string) => apiRequest<LoginResponse>('/auth/google', { method: 'POST', body: { idToken }, auth: false }),
    apple: (body: AppleSignInRequest) => apiRequest<LoginResponse>('/auth/apple', { method: 'POST', body, auth: false }),
    verifyTwoFactor: (body: TwoFactorVerifyRequest) =>
      apiRequest<AuthResponse>('/auth/2fa/verify', { method: 'POST', body, auth: false }),
    logout: (refreshToken: string) =>
      apiRequest<void>('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }),
    /** returns new tokens; every other session is signed out */
    changePassword: (body: ChangePasswordRequest) =>
      apiRequest<AuthResponse>('/auth/change-password', { method: 'POST', body }),
    twoFactorSetup: () => apiRequest<TwoFactorSetupResponse>('/auth/2fa/setup', { method: 'POST' }),
    twoFactorEnable: (code: string) => apiRequest<RecoveryCodesResponse>('/auth/2fa/enable', { method: 'POST', body: { code } }),
    twoFactorDisable: (body: TwoFactorProofRequest) => apiRequest<void>('/auth/2fa/disable', { method: 'POST', body }),
    regenerateRecoveryCodes: (body: TwoFactorProofRequest) =>
      apiRequest<RecoveryCodesResponse>('/auth/2fa/recovery-codes', { method: 'POST', body }),
    linkGoogle: (idToken: string) => apiRequest<MeResponse>('/auth/providers/google', { method: 'POST', body: { idToken } }),
    linkApple: (body: Omit<AppleSignInRequest, 'fullName'>) =>
      apiRequest<MeResponse>('/auth/providers/apple', { method: 'POST', body }),
    unlinkProvider: (provider: Exclude<AuthProviderType, 'PASSWORD'>) =>
      apiRequest<MeResponse>(`/auth/providers/${provider}`, { method: 'DELETE' }),
  },

  /** The one-time unlock (see docs/PAYMENTS.md). Reachable before paying. */
  billing: {
    status: () => apiRequest<BillingStatusResponse>('/billing/status'),
    /** the server confirms the purchase with the store and answers with the refreshed profile */
    sync: () => apiRequest<MeResponse>('/billing/sync', { method: 'POST' }),
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
    /** newest first; "Show all" when nextCursor is set */
    recent: (limit = 6) => apiRequest<Paginated<NotificationResponse>>(`/notifications${query({ limit })}`),
    history: (cursor?: string) => apiRequest<Paginated<NotificationResponse>>(`/notifications${query({ cursor, limit: 30 })}`),
    unreadCount: () => apiRequest<UnreadCountResponse>('/notifications/unread-count'),
    /** answers the unread count after the change */
    markOneRead: (id: string) => apiRequest<UnreadCountResponse>(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => apiRequest<UnreadCountResponse>('/notifications/read-all', { method: 'PATCH' }),
  },

  /** Admin console; every route answers 403 ADMIN_ONLY for non-admins. */
  admin: {
    overview: () => apiRequest<AdminOverview>('/admin/overview'),
    users: (filters: AdminUserListQuery, cursor?: string) =>
      apiRequest<Paginated<AdminUserListItem>>(`/admin/users${query({ ...filters, cursor, limit: 20 })}`),
    user: (publicId: string) => apiRequest<AdminUserDetail>(`/admin/users/${encodeURIComponent(publicId)}`),
    /** includes PERSONAL cards */
    userCollection: (publicId: string, cursor?: string) =>
      apiRequest<Paginated<CollectionItemResponse>>(
        `/admin/users/${encodeURIComponent(publicId)}/collection${query({ cursor, limit: 20 })}`,
      ),
    userTrades: (publicId: string, cursor?: string) =>
      apiRequest<Paginated<AdminTradeListItem>>(`/admin/users/${encodeURIComponent(publicId)}/trades${query({ cursor, limit: 20 })}`),
    userReviews: (publicId: string) => apiRequest<AdminUserReviews>(`/admin/users/${encodeURIComponent(publicId)}/reviews`),
    trades: (filters: AdminTradeListQuery, cursor?: string) =>
      apiRequest<Paginated<AdminTradeListItem>>(`/admin/trades${query({ ...filters, cursor, limit: 20 })}`),
    trade: (id: string) => apiRequest<AdminTradeDetail>(`/admin/trades/${id}`),
    // Changes: every one is written to the audit log (with the optional reason).
    updateUser: (publicId: string, body: AdminUpdateUserRequest) =>
      apiRequest<AdminUserDetail>(`/admin/users/${encodeURIComponent(publicId)}`, { method: 'PATCH', body }),
    updateVendor: (publicId: string, body: AdminUpdateVendorRequest) =>
      apiRequest<AdminUserDetail>(`/admin/users/${encodeURIComponent(publicId)}/vendor`, { method: 'PATCH', body }),
    /** newest first */
    userHistory: (publicId: string) => apiRequest<AdminAuditEntry[]>(`/admin/users/${encodeURIComponent(publicId)}/history`),
    cards: (filters: AdminCardListQuery, cursor?: string) =>
      apiRequest<Paginated<AdminCardListItem>>(`/admin/cards${query({ ...filters, cursor, limit: 20 })}`),
    card: (id: string) => apiRequest<AdminCardDetail>(`/admin/cards/${id}`),
    updateCard: (id: string, body: AdminUpdateCardRequest) =>
      apiRequest<AdminCardDetail>(`/admin/cards/${id}`, { method: 'PATCH', body }),
    analytics: () => apiRequest<AdminAnalytics>('/admin/analytics'),
    /** SUPER_ADMIN only */
    changeRole: (publicId: string, body: AdminChangeRoleRequest) =>
      apiRequest<AdminUserDetail>(`/admin/users/${encodeURIComponent(publicId)}/role`, { method: 'PATCH', body }),
    resetPassword: (publicId: string, body: AdminResetPasswordRequest) =>
      apiRequest<AdminUserDetail>(`/admin/users/${encodeURIComponent(publicId)}/reset-password`, { method: 'POST', body }),
    grantAccess: (publicId: string, body: AdminAccessRequest) =>
      apiRequest<AdminUserDetail>(`/admin/users/${encodeURIComponent(publicId)}/grant-access`, { method: 'POST', body }),
    revokeAccess: (publicId: string, body: AdminAccessRequest) =>
      apiRequest<AdminUserDetail>(`/admin/users/${encodeURIComponent(publicId)}/revoke-access`, { method: 'POST', body }),
    block: (publicId: string, body: AdminBlockRequest) =>
      apiRequest<AdminUserDetail>(`/admin/users/${encodeURIComponent(publicId)}/block`, { method: 'POST', body }),
    unblock: (publicId: string, body: AdminBlockRequest) =>
      apiRequest<AdminUserDetail>(`/admin/users/${encodeURIComponent(publicId)}/unblock`, { method: 'POST', body }),
    /** SUPER_ADMIN only */
    createAdmin: (body: AdminCreateAdminRequest) => apiRequest<AdminUserDetail>('/admin/admins', { method: 'POST', body }),
    /** SUPER_ADMIN only */
    audit: (filters: AdminAuditQuery, cursor?: string) =>
      apiRequest<Paginated<AdminAuditEntry>>(`/admin/audit${query({ ...filters, cursor, limit: 30 })}`),
    /** SUPER_ADMIN only */
    broadcast: (body: AdminBroadcastRequest) =>
      apiRequest<AdminBroadcastResponse>('/admin/notifications/broadcast', { method: 'POST', body }),
  },
};
