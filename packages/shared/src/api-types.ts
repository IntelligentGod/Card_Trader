/**
 * API contract shared by apps/api (response mappers) and apps/mobile (client).
 * Dates are ISO-8601 strings; plain dates are YYYY-MM-DD. Money is integer cents.
 */
import type {
  AuthProviderType,
  CardCategory,
  CatalogSource,
  CardCondition,
  EventStatus,
  GradingCompany,
  ListingStatus,
  NotificationType,
  TradeRole,
  TradeStatus,
  UserRole,
  UserStatus,
  ValueConfidence,
  VendorApplicationStatus,
} from './enums';
import type { MoverWindow, ValueRange } from './ranges';

// ───────────── Common ─────────────
export interface Paginated<T> {
  data: T[];
  nextCursor: string | null;
}

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

// ───────────── Auth ─────────────
export interface RegisterRequest {
  email: string;
  password: string;
  /** unique handle: 3–20 of a-z, 0-9, _ (case-insensitive) */
  username: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** seconds until the access token expires */
  accessTokenExpiresIn: number;
}

export interface AuthResponse {
  user: MeResponse;
  tokens: AuthTokens;
}

/**
 * The password (or Google/Apple) was right but the account has 2FA: no session
 * exists yet. Send the 6-digit code or a recovery code to POST /auth/2fa/verify.
 */
export interface TwoFactorChallengeResponse {
  twoFactorRequired: true;
  challengeToken: string;
  /** seconds the challenge stays valid */
  expiresIn: number;
}

/** Every sign-in endpoint (password, Google, Apple) answers with one of these. */
export type LoginResponse = AuthResponse | TwoFactorChallengeResponse;

export const isTwoFactorChallenge = (response: LoginResponse): response is TwoFactorChallengeResponse =>
  'twoFactorRequired' in response && response.twoFactorRequired === true;

/** Google Sign-In ID token (its `aud` must be one of GOOGLE_CLIENT_IDS). */
export interface GoogleSignInRequest {
  idToken: string;
}

/** Sign in with Apple identity token. `nonce` is the raw nonce whose SHA-256 was sent to Apple. */
export interface AppleSignInRequest {
  identityToken: string;
  nonce: string;
  /** Apple sends the name only on the very first sign-in, to the app */
  fullName?: { givenName?: string | null; familyName?: string | null } | null;
}

export interface TwoFactorVerifyRequest {
  challengeToken: string;
  /** 6-digit authenticator code, or */
  code?: string;
  /** one of the recovery codes shown at setup */
  recoveryCode?: string;
}

export interface TwoFactorSetupResponse {
  /** base32, for typing into the authenticator by hand */
  secret: string;
  /** otpauth:// URI to show as a QR code */
  otpauthUrl: string;
}

export interface TwoFactorCodeRequest {
  code: string;
}

/** Disabling or regenerating needs proof: an authenticator code or an unused recovery code. */
export interface TwoFactorProofRequest {
  code?: string;
  recoveryCode?: string;
}

export interface RecoveryCodesResponse {
  /** shown once; store them somewhere safe */
  recoveryCodes: string[];
}

export interface ChangePasswordRequest {
  /** required unless an admin reset the password or the account has none yet */
  currentPassword?: string;
  newPassword: string;
}

// ───────────── Users ─────────────
export const SOCIAL_LINK_KEYS = ['instagram', 'x', 'tiktok', 'youtube', 'facebook', 'website'] as const;
export type SocialLinkKey = (typeof SOCIAL_LINK_KEYS)[number];
/** Handles or URLs, keyed by network. Missing keys are not set. */
export type SocialLinks = Partial<Record<SocialLinkKey, string>>;

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export interface VendorProfileResponse {
  isActive: boolean;
  businessName: string;
  logoUrl: string | null;
  logoKey: string | null;
  description: string | null;
  website: string | null;
  socialLinks: SocialLinks;
}

/** Vendor details other users see (only while Vendor Mode is on). */
export interface PublicVendorInfo {
  businessName: string;
  logoUrl: string | null;
  description: string | null;
  website: string | null;
  socialLinks: SocialLinks;
}

export interface UpsertVendorProfileRequest {
  /** false switches Vendor Mode off but keeps the details */
  isActive: boolean;
  businessName: string;
  logoKey?: string | null;
  description?: string | null;
  website?: string | null;
  socialLinks?: SocialLinks;
}

export interface ProfileStats {
  ratingAverage: number | null;
  ratingCount: number;
  completedTradeCount: number;
}

export interface MeResponse {
  publicId: string;
  email: string;
  /** ADMIN or SUPER_ADMIN unlocks the admin console */
  role: UserRole;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  socialLinks: SocialLinks;
  /** null until Vendor Mode was set up once; check isActive */
  vendor: VendorProfileResponse | null;
  stats: ProfileStats;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  /** an admin reset the password: only changing it is allowed until then */
  mustChangePassword: boolean;
  /** false for Google/Apple-only accounts */
  hasPassword: boolean;
  /** sign-in methods linked to the account */
  authProviders: AuthProviderType[];
  /** false only while the paywall is on and this USER account hasn't bought (or been granted) the one-time unlock */
  hasFullAccess: boolean;
  createdAt: string;
}

// ───────────── Billing (one-time unlock) ─────────────

/** Where the unlock came from. */
export type PaidVia = 'APP_STORE' | 'PLAY_STORE' | 'ADMIN' | 'SEED';

export interface BillingStatusResponse {
  hasFullAccess: boolean;
  /** false before the store products exist: everyone has access then */
  paywallEnabled: boolean;
  /** the server can confirm purchases with RevenueCat */
  storeConfigured: boolean;
  /** RevenueCat entitlement the app checks (full_access) */
  entitlementId: string;
  paidAt: string | null;
  paidVia: PaidVia | null;
}

export interface UpdateMeRequest {
  username?: string;
  displayName?: string;
  bio?: string | null;
  /** key returned by the upload endpoint, or null to remove */
  avatarKey?: string | null;
  location?: string | null;
  socialLinks?: SocialLinks;
}

export interface PublicUserLite {
  publicId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  ratingAverage: number | null;
  completedTradeCount: number;
  /** business name while Vendor Mode is on */
  vendorName: string | null;
}

export interface PublicProfile {
  publicId: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  socialLinks: SocialLinks;
  vendor: PublicVendorInfo | null;
  stats: ProfileStats;
  memberSince: string;
  /** cards listed for trade and/or sale */
  availableCount: number;
  forTradeCount: number;
  forSaleCount: number;
}

export interface QrPayload {
  publicId: string;
  deepLink: string;
}

// ───────────── Uploads ─────────────
export type UploadPurpose = 'AVATAR' | 'ITEM_IMAGE' | 'VENDOR_LOGO';

export interface UploadResponse {
  key: string;
  url: string;
}

// ───────────── Catalog ─────────────
export interface CardSetSummary {
  id: string;
  category: CardCategory;
  code: string;
  name: string;
  year: number | null;
  manufacturer: string | null;
}

export interface CardSummary {
  id: string;
  category: CardCategory;
  name: string;
  cardNumber: string;
  variant: string;
  subject: string | null;
  rarity: string | null;
  imageUrl: string | null;
  isVerified: boolean;
  set: CardSetSummary;
}

export interface CreateCardRequest {
  setId: string;
  name: string;
  cardNumber: string;
  variant?: string;
  subject?: string;
  rarity?: string;
  imageUrl?: string;
}

// ───────────── Pricing ─────────────
export interface SaleRecord {
  id: string;
  priceCents: number;
  soldAt: string;
  source: string;
  tierKey: string;
  listingTitle: string | null;
}

export interface MarketValueResponse {
  cardId: string;
  tierKey: string;
  tierLabel: string;
  valueCents: number | null;
  confidence: ValueConfidence;
  sampleSize: number;
  lastSaleAt: string | null;
  computedAt: string | null;
  algorithm: string | null;
  recentSales: SaleRecord[];
  disclaimer: string;
}

export interface ValuePoint {
  date: string;
  valueCents: number;
}

export interface CardValueHistoryResponse {
  cardId: string;
  tierKey: string;
  tierLabel: string;
  range: ValueRange;
  points: ValuePoint[];
  sales: SaleRecord[];
}

// ───────────── Collection ─────────────
export interface CollectionItemResponse {
  id: string;
  card: CardSummary;
  quantity: number;
  condition: CardCondition;
  gradingCompany: GradingCompany | null;
  grade: number | null;
  certNumber: string | null;
  tierKey: string;
  tierLabel: string;
  purchasePriceCents: number | null;
  purchaseDate: string | null;
  notes: string | null;
  /** front photo, else catalog image */
  imageUrl: string | null;
  customImageKey: string | null;
  backImageUrl: string | null;
  backImageKey: string | null;
  listingStatus: ListingStatus;
  /** optional asking price per copy */
  askingPriceCents: number | null;
  /** estimated value of ONE copy */
  estimatedValueCents: number | null;
  /** estimated value × quantity */
  totalValueCents: number | null;
  valueUpdatedAt: string | null;
  lockedInTrade: boolean;
  /** ids of events this card is marked "Bringing to this event" for */
  eventIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicCollectionItem {
  id: string;
  card: CardSummary;
  quantity: number;
  condition: CardCondition;
  gradingCompany: GradingCompany | null;
  grade: number | null;
  certNumber: string | null;
  tierKey: string;
  tierLabel: string;
  imageUrl: string | null;
  backImageUrl: string | null;
  listingStatus: ListingStatus;
  askingPriceCents: number | null;
  estimatedValueCents: number | null;
  totalValueCents: number | null;
}

export interface CreateCollectionItemRequest {
  cardId: string;
  quantity?: number;
  condition: CardCondition;
  gradingCompany?: GradingCompany | null;
  grade?: number | null;
  certNumber?: string | null;
  purchasePriceCents?: number | null;
  purchaseDate?: string | null;
  notes?: string | null;
  customImageKey?: string | null;
  backImageKey?: string | null;
  listingStatus?: ListingStatus;
  askingPriceCents?: number | null;
}

export type UpdateCollectionItemRequest = Partial<Omit<CreateCollectionItemRequest, 'cardId'>>;

export type CollectionSort = 'value_desc' | 'value_asc' | 'newest' | 'name';

// ───────────── Portfolio ─────────────
export interface ChangeStat {
  amountCents: number;
  percent: number | null;
}

export interface CategoryValue {
  category: CardCategory;
  valueCents: number;
  cardCount: number;
}

export interface PortfolioSummary {
  totalValueCents: number;
  cardCount: number;
  itemCount: number;
  unpricedCount: number;
  byCategory: CategoryValue[];
  /** market movement on CURRENT holdings (excludes additions/removals) */
  change: Record<MoverWindow, ChangeStat>;
  disclaimer: string;
}

export interface PortfolioValueHistory {
  range: ValueRange;
  points: ValuePoint[];
}

export interface Mover {
  item: CollectionItemResponse;
  previousValueCents: number;
  currentValueCents: number;
  changeCents: number;
  percent: number | null;
}

// ───────────── Trades ─────────────
/**
 * COUNTER: the receiver of an offer may change it; that makes it a draft again,
 * which they then send back. EDIT on an ACCEPTED trade resets both acceptances.
 */
export type TradeAction = 'EDIT' | 'PROPOSE' | 'COUNTER' | 'ACCEPT' | 'DECLINE' | 'COMPLETE' | 'CANCEL' | 'REVIEW';

/** A comparable sale snapshotted with a trade line. */
export interface CompSale {
  priceCents: number;
  soldAt: string;
  source: string;
}

export interface TradeItemResponse {
  id: string;
  collectionItemId: string | null;
  cardId: string;
  quantity: number;
  cardName: string;
  setName: string;
  cardNumber: string;
  variant: string;
  category: CardCategory;
  condition: CardCondition;
  gradingCompany: GradingCompany | null;
  grade: number | null;
  certNumber: string | null;
  tierLabel: string;
  imageUrl: string | null;
  comps: CompSale[];
  unitValueCents: number | null;
  lineTotalCents: number;
  valueConfidence: ValueConfidence;
  valuedAt: string;
}

export interface TradeParticipantResponse {
  role: TradeRole;
  user: PublicUserLite;
  itemsTotalCents: number;
  hasAcceptedCurrentVersion: boolean;
  completionConfirmed: boolean;
  items: TradeItemResponse[];
}

export interface TradeCalculation {
  initiatorTotalCents: number;
  counterpartyTotalCents: number;
  /** initiator total − counterparty total */
  differenceCents: number;
  suggestedCashPayer: TradeRole | null;
  suggestedCashCents: number;
  hasUnpricedItems: boolean;
}

export interface TradeCash {
  payer: TradeRole | null;
  amountCents: number;
  isManual: boolean;
}

export interface TradeResponse {
  id: string;
  status: TradeStatus;
  version: number;
  myRole: TradeRole;
  initiator: TradeParticipantResponse;
  counterparty: TradeParticipantResponse;
  calculation: TradeCalculation;
  cash: TradeCash;
  /** value each side gives including agreed cash */
  finalValue: { initiatorGivesCents: number; counterpartyGivesCents: number };
  allowedActions: TradeAction[];
  myReview: ReviewResponse | null;
  proposedByRole: TradeRole | null;
  /** offers sent so far; the 2nd and later are counteroffers */
  proposalCount: number;
  isCounterOffer: boolean;
  /** card show the trade was started from */
  event: { id: string; title: string } | null;
  proposedAt: string | null;
  acceptedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  declinedAt: string | null;
  createdAt: string;
  updatedAt: string;
  disclaimer: string;
}

export interface TradeListItem {
  id: string;
  status: TradeStatus;
  myRole: TradeRole;
  otherUser: PublicUserLite;
  myItemsTotalCents: number;
  theirItemsTotalCents: number;
  itemCount: number;
  cash: TradeCash;
  awaitingMe: boolean;
  isCounterOffer: boolean;
  updatedAt: string;
  completedAt: string | null;
}

export interface CreateTradeRequest {
  counterpartyPublicId: string;
  eventId?: string;
}

export interface AddTradeItemRequest {
  collectionItemId: string;
  quantity?: number;
}

export interface SetTradeCashRequest {
  /** null clears the manual override and returns to the suggested amount */
  payer: TradeRole | null;
  amountCents: number;
  useSuggested?: boolean;
}

export interface TradeVersionRequest {
  expectedVersion: number;
}

// ───────────── Reviews ─────────────
export interface ReviewResponse {
  id: string;
  tradeId: string;
  rating: number;
  comment: string | null;
  reviewer: PublicUserLite;
  /** left after a completed trade in this app */
  verifiedTrade: boolean;
  createdAt: string;
}

export interface CreateReviewRequest {
  rating: number;
  comment?: string | null;
}

// ───────────── Events ─────────────
export type EventListScope = 'upcoming' | 'organizing' | 'mine';

export interface EventSummary {
  id: string;
  title: string;
  status: EventStatus;
  startsAt: string;
  endsAt: string;
  venueName: string;
  city: string;
  region: string | null;
  admission: string | null;
  /** organizerName if set, else the organizer's display name */
  organizerDisplayName: string;
  approvedVendorCount: number;
  isSaved: boolean;
  isOrganizer: boolean;
  myVendorStatus: VendorApplicationStatus | null;
}

export interface EventVendorResponse {
  id: string;
  status: VendorApplicationStatus;
  tableNumber: string | null;
  message: string | null;
  vendor: PublicUserLite;
  vendorInfo: PublicVendorInfo | null;
  inventoryCount: number;
  createdAt: string;
  decidedAt: string | null;
}

export interface EventDetail extends EventSummary {
  description: string | null;
  address: string | null;
  country: string;
  website: string | null;
  socialLinks: SocialLinks;
  organizer: PublicUserLite;
  /** approved vendors; organizers see every application via the vendors endpoint */
  vendors: EventVendorResponse[];
  myApplication: EventVendorResponse | null;
  pendingApplicationCount: number;
  /** cards across approved vendors marked for this event */
  inventoryCount: number;
}

export interface CreateEventRequest {
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  venueName: string;
  address?: string | null;
  city: string;
  region?: string | null;
  country?: string;
  admission?: string | null;
  organizerName?: string | null;
  website?: string | null;
  socialLinks?: SocialLinks;
}

export type UpdateEventRequest = Partial<CreateEventRequest>;

export interface ApplyAsVendorRequest {
  message?: string | null;
}

export interface ApproveVendorRequest {
  tableNumber: string;
}

export interface SetEventInventoryRequest {
  /** replaces the whole "Bringing to this event" selection */
  collectionItemIds: string[];
}

export interface EventInventorySelection {
  collectionItemIds: string[];
}

export type CardKind = 'RAW' | 'GRADED';

export interface EventSearchQuery {
  q?: string;
  set?: string;
  year?: number;
  category?: CardCategory;
  kind?: CardKind;
  grader?: GradingCompany;
  /** exact grade, e.g. 9.5 */
  grade?: number;
  condition?: CardCondition;
  minPriceCents?: number;
  maxPriceCents?: number;
  forSale?: boolean;
  forTrade?: boolean;
  cursor?: string;
  limit?: number;
}

export interface EventSearchResult {
  item: PublicCollectionItem;
  vendor: PublicUserLite;
  vendorInfo: PublicVendorInfo | null;
  tableNumber: string | null;
  /** asking price if set, else estimated value (per copy) */
  priceCents: number | null;
  priceIsAsking: boolean;
}

// ───────────── Notifications ─────────────
export interface NotificationData {
  tradeId?: string;
  eventId?: string;
  publicId?: string;
}

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** navigation target; the "metadata" of the notification */
  data: NotificationData;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface UnreadCountResponse {
  count: number;
}

export interface MarkNotificationsReadRequest {
  /** omit to mark everything read */
  ids?: string[];
}

export const MARKET_VALUE_DISCLAIMER = 'Market values are estimates based on recent comparable sales.';

// ───────────── Admin (read-only console) ─────────────
export interface AdminOverview {
  users: { total: number; active: number; blocked: number; admins: number; vendors: number; newLast7Days: number };
  collection: { items: number; cards: number; totalValueCents: number };
  trades: { total: number; byStatus: Record<TradeStatus, number> };
  events: { total: number; published: number; upcoming: number };
  reviews: { total: number; averageRating: number | null };
}

export interface AdminUserListQuery {
  /** email, username or display name (case-insensitive, partial) */
  q?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface AdminUserListItem {
  publicId: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  /** set once Vendor Mode was configured, even if it is switched off now */
  vendor: { businessName: string; isActive: boolean } | null;
  collectionCount: number;
  tradeCount: number;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  hasFullAccess: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export type AdminEventRelation = 'ORGANIZER' | 'VENDOR' | 'SAVED';

export interface AdminUserEvent {
  id: string;
  title: string;
  status: EventStatus;
  startsAt: string;
  relation: AdminEventRelation;
  /** for VENDOR */
  vendorStatus: VendorApplicationStatus | null;
  tableNumber: string | null;
}

export interface AdminUserDetail {
  publicId: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  socialLinks: SocialLinks;
  vendor: VendorProfileResponse | null;
  stats: ProfileStats;
  counts: {
    collectionItems: number;
    /** sum of quantities */
    cards: number;
    trades: number;
    activeTrades: number;
    reviewsReceived: number;
    reviewsWritten: number;
  };
  collectionValueCents: number;
  events: AdminUserEvent[];
  /** latest sign-in or token refresh */
  lastActiveAt: string | null;
  lastLoginAt: string | null;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  mustChangePassword: boolean;
  hasPassword: boolean;
  authProviders: AuthProviderType[];
  blockedAt: string | null;
  blockReason: string | null;
  hasFullAccess: boolean;
  paidAt: string | null;
  paidVia: PaidVia | null;
  /** what the signed-in admin may do to this account (the API enforces the same rules) */
  permissions: AdminUserPermissions;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserPermissions {
  editProfile: boolean;
  changeRole: boolean;
  resetPassword: boolean;
  block: boolean;
}

export interface AdminTradeListQuery {
  status?: TradeStatus;
}

export interface AdminTradeListItem {
  id: string;
  status: TradeStatus;
  initiator: PublicUserLite;
  counterparty: PublicUserLite;
  initiatorItemsTotalCents: number;
  counterpartyItemsTotalCents: number;
  itemCount: number;
  cash: TradeCash;
  isCounterOffer: boolean;
  event: { id: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/** A trade seen by neither side: no viewer role, actions or "my review". */
export type AdminTradeDetail = Omit<TradeResponse, 'myRole' | 'allowedActions' | 'myReview'> & {
  reviews: ReviewResponse[];
};

export interface AdminReview extends ReviewResponse {
  /** the user who was reviewed */
  subject: PublicUserLite;
}

export interface AdminUserReviews {
  received: AdminReview[];
  written: AdminReview[];
}

// ───────────── Admin: changes (every change is written to the audit log) ─────────────
/** Every field is optional; send only what changes. `reason` is stored in the audit log. */
export interface AdminUpdateUserRequest {
  email?: string;
  username?: string;
  displayName?: string;
  bio?: string | null;
  location?: string | null;
  socialLinks?: SocialLinks;
  /** true deletes the profile photo */
  removeAvatar?: boolean;
  reason?: string | null;
}

/** SUPER_ADMIN only. Nobody can be made SUPER_ADMIN through the API. */
export interface AdminChangeRoleRequest {
  role: 'USER' | 'ADMIN';
  reason?: string | null;
}

/** The new password is hashed at once, never logged or returned; every session of the user ends. */
export interface AdminResetPasswordRequest {
  newPassword: string;
  /** default true: the user must choose their own password at next sign-in */
  requireChange?: boolean;
  reason?: string | null;
}

/** Grant / revoke the one-time unlock from the admin console. */
export interface AdminAccessRequest {
  reason?: string | null;
}

export interface AdminBlockRequest {
  reason?: string | null;
}

/** SUPER_ADMIN only: creates an account with role ADMIN that must change its password. */
export interface AdminCreateAdminRequest {
  email: string;
  username: string;
  displayName: string;
  temporaryPassword: string;
}

/** SUPER_ADMIN only: an ANNOUNCEMENT notification to every active user. */
export interface AdminBroadcastRequest {
  title: string;
  message: string;
}

export interface AdminBroadcastResponse {
  recipients: number;
}

export interface AdminAuditQuery {
  action?: string;
  targetType?: AdminTargetType;
}

/** Edits an existing vendor profile; send only what changes. */
export interface AdminUpdateVendorRequest {
  isActive?: boolean;
  businessName?: string;
  description?: string | null;
  website?: string | null;
  socialLinks?: SocialLinks;
  /** true deletes the vendor logo */
  removeLogo?: boolean;
  reason?: string | null;
}

export type AdminTargetType = 'USER' | 'CARD' | 'SYSTEM';

export interface AdminAuditEntry {
  id: string;
  /**
   * USER_UPDATED, USER_DISABLED, USER_ENABLED, USER_PASSWORD_RESET, VENDOR_UPDATED,
   * ADMIN_CREATED, ADMIN_REMOVED, ADMIN_ROLE_CHANGED, ADMIN_DISABLED, ADMIN_ENABLED,
   * CARD_UPDATED, CARD_VERIFIED, CARD_UNVERIFIED, ANNOUNCEMENT_SENT, ACCESS_GRANTED, ACCESS_REVOKED
   */
  action: string;
  targetType: AdminTargetType;
  targetId: string;
  /** field → before/after */
  changes: Record<string, { from: unknown; to: unknown }>;
  reason: string | null;
  /** null fields when a normal admin views an action taken by a super admin */
  admin: { publicId: string | null; displayName: string; email: string | null };
  /** the user the action was about, when there is one */
  target: { publicId: string; displayName: string } | null;
  /** SUPER_ADMIN viewers only */
  ipAddress: string | null;
  createdAt: string;
}

// ───────────── Admin: card catalog ─────────────
export interface AdminCardListQuery {
  /** name, number, subject or set name */
  q?: string;
  category?: CardCategory;
  source?: CatalogSource;
  /** 'true' or 'false' in the query string */
  verified?: boolean;
}

export interface AdminCardListItem {
  id: string;
  category: CardCategory;
  name: string;
  cardNumber: string;
  variant: string;
  subject: string | null;
  rarity: string | null;
  imageUrl: string | null;
  set: CardSetSummary;
  source: CatalogSource;
  /** user-submitted cards stay unverified (only the submitter sees them) until approved */
  isVerified: boolean;
  submittedBy: PublicUserLite | null;
  /** collection rows holding this card */
  collectionItemCount: number;
  /** highest current market value across conditions/grades */
  topValueCents: number | null;
  createdAt: string;
}

export interface AdminCardMarketValue {
  tierKey: string;
  tierLabel: string;
  valueCents: number | null;
  confidence: ValueConfidence;
  sampleSize: number;
  lastSaleAt: string | null;
  computedAt: string | null;
}

export interface AdminCardDetail extends AdminCardListItem {
  externalRef: string | null;
  /** distinct users with the card in their collection */
  ownerCount: number;
  /** sum of quantities across all collections */
  copies: number;
  tradeItemCount: number;
  marketValues: AdminCardMarketValue[];
  history: AdminAuditEntry[];
  updatedAt: string;
}

export interface AdminUpdateCardRequest {
  name?: string;
  cardNumber?: string;
  variant?: string;
  subject?: string | null;
  rarity?: string | null;
  imageUrl?: string | null;
  isVerified?: boolean;
  reason?: string | null;
}

// ───────────── Admin: analytics ─────────────
export interface AdminMonthCount {
  /** YYYY-MM (UTC) */
  month: string;
  count: number;
}

export interface AdminAnalytics {
  users: {
    byStatus: Record<UserStatus, number>;
    /** SUPER_ADMIN appears only for super-admin viewers */
    byRole: Partial<Record<UserRole, number>>;
    vendors: number;
    /** last 12 months, oldest first, months with no signups included as 0 */
    signupsByMonth: AdminMonthCount[];
  };
  collection: {
    byCategory: { category: CardCategory; items: number; cards: number; valueCents: number }[];
    byListingStatus: Record<ListingStatus, number>;
    rawItems: number;
    gradedItems: number;
    /** graded items per grading company */
    byGrader: Record<GradingCompany, number>;
  };
  catalog: {
    total: number;
    verified: number;
    unverified: number;
    byCategory: Record<CardCategory, number>;
    bySource: Record<CatalogSource, number>;
  };
  trades: {
    byStatus: Record<TradeStatus, number>;
    /** last 12 months, oldest first; value = both sides' card totals */
    completedByMonth: (AdminMonthCount & { valueCents: number })[];
    averageCompletedValueCents: number | null;
  };
  /** cards with the highest total value across all collections */
  topCards: { cardId: string; name: string; setName: string; category: CardCategory; copies: number; valueCents: number }[];
  generatedAt: string;
}
