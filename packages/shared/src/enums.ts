/**
 * Domain enums shared by the API and the mobile app.
 * These mirror the Prisma enums; apps/api has a test asserting they stay in sync.
 */

export const CardCategory = {
  POKEMON: 'POKEMON',
  ONE_PIECE: 'ONE_PIECE',
  SPORTS: 'SPORTS',
} as const;
export type CardCategory = (typeof CardCategory)[keyof typeof CardCategory];
export const CARD_CATEGORIES = Object.values(CardCategory);

/** Raw cards carry a user-assessed condition; RAW means "not assessed". */
export const CardCondition = {
  RAW: 'RAW',
  MINT: 'MINT',
  NEAR_MINT: 'NEAR_MINT',
  EXCELLENT: 'EXCELLENT',
  VERY_GOOD: 'VERY_GOOD',
  GOOD: 'GOOD',
  PLAYED: 'PLAYED',
  POOR: 'POOR',
  GRADED: 'GRADED',
} as const;
export type CardCondition = (typeof CardCondition)[keyof typeof CardCondition];
export const CARD_CONDITIONS = Object.values(CardCondition);

export const GradingCompany = {
  PSA: 'PSA',
  BGS: 'BGS',
  CGC: 'CGC',
  OTHER: 'OTHER',
} as const;
export type GradingCompany = (typeof GradingCompany)[keyof typeof GradingCompany];
export const GRADING_COMPANIES = Object.values(GradingCompany);

/** What the owner wants to do with a card. PERSONAL cards are never shown to others. */
export const ListingStatus = {
  PERSONAL: 'PERSONAL',
  FOR_TRADE: 'FOR_TRADE',
  FOR_SALE: 'FOR_SALE',
  TRADE_AND_SALE: 'TRADE_AND_SALE',
} as const;
export type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus];
export const LISTING_STATUSES = Object.values(ListingStatus);
/** Statuses other users can see (and pull into a trade). */
export const PUBLIC_LISTING_STATUSES: readonly ListingStatus[] = ['FOR_TRADE', 'FOR_SALE', 'TRADE_AND_SALE'];

export function isForTrade(status: ListingStatus): boolean {
  return status === 'FOR_TRADE' || status === 'TRADE_AND_SALE';
}

export function isForSale(status: ListingStatus): boolean {
  return status === 'FOR_SALE' || status === 'TRADE_AND_SALE';
}

export const CatalogSource = {
  SEED: 'SEED',
  IMPORT: 'IMPORT',
  USER_SUBMITTED: 'USER_SUBMITTED',
} as const;
export type CatalogSource = (typeof CatalogSource)[keyof typeof CatalogSource];

export const ValueConfidence = {
  NONE: 'NONE',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;
export type ValueConfidence = (typeof ValueConfidence)[keyof typeof ValueConfidence];

export const TradeStatus = {
  DRAFT: 'DRAFT',
  PROPOSED: 'PROPOSED',
  ACCEPTED: 'ACCEPTED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  DECLINED: 'DECLINED',
} as const;
export type TradeStatus = (typeof TradeStatus)[keyof typeof TradeStatus];
export const TRADE_STATUSES = Object.values(TradeStatus);
export const ACTIVE_TRADE_STATUSES: readonly TradeStatus[] = ['DRAFT', 'PROPOSED', 'ACCEPTED'];
export const CLOSED_TRADE_STATUSES: readonly TradeStatus[] = ['COMPLETED', 'CANCELLED', 'DECLINED'];

export const TradeRole = {
  INITIATOR: 'INITIATOR',
  COUNTERPARTY: 'COUNTERPARTY',
} as const;
export type TradeRole = (typeof TradeRole)[keyof typeof TradeRole];

export const EventStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  CANCELLED: 'CANCELLED',
} as const;
export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

export const VendorApplicationStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DECLINED: 'DECLINED',
  WITHDRAWN: 'WITHDRAWN',
} as const;
export type VendorApplicationStatus = (typeof VendorApplicationStatus)[keyof typeof VendorApplicationStatus];

export const NotificationType = {
  TRADE_OFFER: 'TRADE_OFFER',
  TRADE_COUNTER: 'TRADE_COUNTER',
  TRADE_ACCEPTED: 'TRADE_ACCEPTED',
  TRADE_DECLINED: 'TRADE_DECLINED',
  TRADE_CANCELLED: 'TRADE_CANCELLED',
  TRADE_TERMS_CHANGED: 'TRADE_TERMS_CHANGED',
  TRADE_COMPLETED: 'TRADE_COMPLETED',
  REVIEW_RECEIVED: 'REVIEW_RECEIVED',
  VENDOR_APPLICATION: 'VENDOR_APPLICATION',
  VENDOR_APPROVED: 'VENDOR_APPROVED',
  VENDOR_DECLINED: 'VENDOR_DECLINED',
  EVENT_UPDATED: 'EVENT_UPDATED',
  EVENT_CANCELLED: 'EVENT_CANCELLED',
  EVENT_REMINDER: 'EVENT_REMINDER',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const CATEGORY_LABELS: Record<CardCategory, string> = {
  POKEMON: 'Pokémon',
  ONE_PIECE: 'One Piece',
  SPORTS: 'Sports',
};

export const CONDITION_LABELS: Record<CardCondition, string> = {
  RAW: 'Raw',
  MINT: 'Mint',
  NEAR_MINT: 'Near Mint',
  EXCELLENT: 'Excellent',
  VERY_GOOD: 'Very Good',
  GOOD: 'Good',
  PLAYED: 'Played',
  POOR: 'Poor',
  GRADED: 'Graded',
};

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  PERSONAL: 'Personal collection',
  FOR_TRADE: 'For trade',
  FOR_SALE: 'For sale',
  TRADE_AND_SALE: 'Trade + sale',
};

export const VENDOR_APPLICATION_LABELS: Record<VendorApplicationStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  WITHDRAWN: 'Withdrawn',
};

export const TRADE_STATUS_LABELS: Record<TradeStatus, string> = {
  DRAFT: 'Draft',
  PROPOSED: 'Proposed',
  ACCEPTED: 'Accepted',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  DECLINED: 'Declined',
};
