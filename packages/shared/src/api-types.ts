/**
 * API contract shared by apps/api (response mappers) and apps/mobile (client).
 * Dates are ISO-8601 strings; plain dates are YYYY-MM-DD. Money is integer cents.
 */
import type {
  CardCategory,
  CardCondition,
  EventStatus,
  GradingCompany,
  ListingStatus,
  NotificationType,
  TradeRole,
  TradeStatus,
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
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  socialLinks: SocialLinks;
  /** null until Vendor Mode was set up once; check isActive */
  vendor: VendorProfileResponse | null;
  stats: ProfileStats;
  createdAt: string;
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
  data: NotificationData;
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
