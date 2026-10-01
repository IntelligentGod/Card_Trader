import {
  SOCIAL_LINK_KEYS,
  USERNAME_PATTERN,
  type AdminCardDetail,
  type AdminUpdateCardRequest,
  type AdminUpdateUserRequest,
  type AdminUpdateVendorRequest,
  type AdminUserDetail,
  type SocialLinks,
  type VendorProfileResponse,
} from '@card-trader/shared';
import { normalizeUsername } from '../auth/validation';
import { cleanSocialLinks, socialLinkErrors } from '../profile/SocialLinksFields';

/**
 * Admin edit forms: client-side checks mirror the API limits for fast feedback,
 * and the diff helpers build PATCH bodies with only the fields that changed.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTTP_URL = /^https?:\/\/\S+$/i;

export const REASON_MAX = 500;

type Errors<K extends string> = Partial<Record<K, string>>;

function sameLinks(a: SocialLinks, b: SocialLinks): boolean {
  const left = cleanSocialLinks(a);
  const right = cleanSocialLinks(b);
  return SOCIAL_LINK_KEYS.every((key) => (left[key] ?? '') === (right[key] ?? ''));
}

const orNull = (value: string) => value.trim() || null;

// ───────────── User ─────────────
export interface UserForm {
  email: string;
  username: string;
  displayName: string;
  bio: string;
  location: string;
  socialLinks: SocialLinks;
  removeAvatar: boolean;
}

export function userFormFrom(user: AdminUserDetail): UserForm {
  return {
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio ?? '',
    location: user.location ?? '',
    socialLinks: user.socialLinks ?? {},
    removeAvatar: false,
  };
}

export function validateUserForm(form: UserForm): Errors<'email' | 'username' | 'displayName' | 'bio' | 'location' | 'socialLinks'> {
  const errors: Errors<'email' | 'username' | 'displayName' | 'bio' | 'location' | 'socialLinks'> = {};
  const email = form.email.trim();
  if (!EMAIL.test(email) || email.length > 254) errors.email = 'Enter a valid email address';
  if (!USERNAME_PATTERN.test(normalizeUsername(form.username))) errors.username = 'Use 3–20 letters, numbers or underscores';
  const name = form.displayName.trim();
  if (name.length < 2 || name.length > 40) errors.displayName = 'Display name must be 2–40 characters';
  if (form.bio.trim().length > 280) errors.bio = 'Bio is at most 280 characters';
  if (form.location.trim().length > 80) errors.location = 'Location is at most 80 characters';
  if (Object.keys(socialLinkErrors(form.socialLinks)).length > 0) errors.socialLinks = 'Fix the social links';
  return errors;
}

/** Only changed fields; `reason` rides along when there is a change. */
export function diffUser(user: AdminUserDetail, form: UserForm, reason: string): AdminUpdateUserRequest {
  const body: AdminUpdateUserRequest = {};
  const email = form.email.trim();
  if (email.toLowerCase() !== user.email.toLowerCase()) body.email = email;
  const username = normalizeUsername(form.username);
  if (username !== user.username) body.username = username;
  const displayName = form.displayName.trim();
  if (displayName !== user.displayName) body.displayName = displayName;
  if (orNull(form.bio) !== (user.bio ?? null)) body.bio = orNull(form.bio);
  if (orNull(form.location) !== (user.location ?? null)) body.location = orNull(form.location);
  if (!sameLinks(form.socialLinks, user.socialLinks ?? {})) body.socialLinks = cleanSocialLinks(form.socialLinks);
  if (form.removeAvatar && user.avatarUrl) body.removeAvatar = true;
  if (Object.keys(body).length > 0 && reason.trim()) body.reason = reason.trim();
  return body;
}

// ───────────── Account actions ─────────────
export interface AdminUserActions {
  edit: boolean;
  /** the role a "Change role" action would set, or null when it is not offered */
  changeRoleTo: 'USER' | 'ADMIN' | null;
  resetPassword: boolean;
  block: boolean;
  unblock: boolean;
}

/** Which action buttons to show — driven only by the server's `permissions` (plus the current role/status). */
export function adminUserActions(user: Pick<AdminUserDetail, 'role' | 'status' | 'permissions'>): AdminUserActions {
  const { permissions } = user;
  return {
    edit: permissions.editProfile,
    changeRoleTo: permissions.changeRole && user.role !== 'SUPER_ADMIN' ? (user.role === 'ADMIN' ? 'USER' : 'ADMIN') : null,
    resetPassword: permissions.resetPassword,
    block: permissions.block && user.status === 'ACTIVE',
    unblock: permissions.block && user.status === 'BLOCKED',
  };
}

export const hasAnyAction = (actions: AdminUserActions) =>
  actions.edit || actions.changeRoleTo !== null || actions.resetPassword || actions.block || actions.unblock;

// ───────────── Passwords, new admins, announcements ─────────────
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export function validateNewPassword(password: string, confirm: string): Errors<'password' | 'confirm'> {
  const errors: Errors<'password' | 'confirm'> = {};
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    errors.password = `Use ${PASSWORD_MIN}–${PASSWORD_MAX} characters`;
  }
  if (confirm !== password) errors.confirm = 'Passwords don’t match';
  return errors;
}

export interface CreateAdminForm {
  email: string;
  username: string;
  displayName: string;
  password: string;
  confirm: string;
}

export function validateCreateAdmin(form: CreateAdminForm): Errors<keyof CreateAdminForm> {
  const errors: Errors<keyof CreateAdminForm> = {};
  const email = form.email.trim();
  if (!EMAIL.test(email) || email.length > 254) errors.email = 'Enter a valid email address';
  if (!USERNAME_PATTERN.test(normalizeUsername(form.username))) errors.username = 'Use 3–20 letters, numbers or underscores';
  const name = form.displayName.trim();
  if (name.length < 2 || name.length > 40) errors.displayName = 'Display name must be 2–40 characters';
  const pw = validateNewPassword(form.password, form.confirm);
  if (pw.password) errors.password = pw.password;
  if (pw.confirm) errors.confirm = pw.confirm;
  return errors;
}

export function validateBroadcast(title: string, message: string): Errors<'title' | 'message'> {
  const errors: Errors<'title' | 'message'> = {};
  const t = title.trim();
  const m = message.trim();
  if (t.length < 3 || t.length > 120) errors.title = 'Title must be 3–120 characters';
  if (m.length < 3 || m.length > 300) errors.message = 'Message must be 3–300 characters';
  return errors;
}

// ───────────── Vendor ─────────────
export interface VendorForm {
  isActive: boolean;
  businessName: string;
  description: string;
  website: string;
  socialLinks: SocialLinks;
  removeLogo: boolean;
}

export function vendorFormFrom(vendor: VendorProfileResponse): VendorForm {
  return {
    isActive: vendor.isActive,
    businessName: vendor.businessName,
    description: vendor.description ?? '',
    website: vendor.website ?? '',
    socialLinks: vendor.socialLinks ?? {},
    removeLogo: false,
  };
}

export function validateVendorForm(form: VendorForm): Errors<'businessName' | 'description' | 'website' | 'socialLinks'> {
  const errors: Errors<'businessName' | 'description' | 'website' | 'socialLinks'> = {};
  const name = form.businessName.trim();
  if (name.length < 2 || name.length > 60) errors.businessName = 'Business name must be 2–60 characters';
  if (form.description.trim().length > 1000) errors.description = 'Description is at most 1000 characters';
  const website = form.website.trim();
  if (website && (!HTTP_URL.test(website) || website.length > 200)) errors.website = 'Use a full link, e.g. https://…';
  if (Object.keys(socialLinkErrors(form.socialLinks)).length > 0) errors.socialLinks = 'Fix the social links';
  return errors;
}

export function diffVendor(vendor: VendorProfileResponse, form: VendorForm, reason: string): AdminUpdateVendorRequest {
  const body: AdminUpdateVendorRequest = {};
  if (form.isActive !== vendor.isActive) body.isActive = form.isActive;
  const businessName = form.businessName.trim();
  if (businessName !== vendor.businessName) body.businessName = businessName;
  if (orNull(form.description) !== (vendor.description ?? null)) body.description = orNull(form.description);
  if (orNull(form.website) !== (vendor.website ?? null)) body.website = orNull(form.website);
  if (!sameLinks(form.socialLinks, vendor.socialLinks ?? {})) body.socialLinks = cleanSocialLinks(form.socialLinks);
  if (form.removeLogo && vendor.logoUrl) body.removeLogo = true;
  if (Object.keys(body).length > 0 && reason.trim()) body.reason = reason.trim();
  return body;
}

// ───────────── Card ─────────────
export interface CardForm {
  name: string;
  cardNumber: string;
  variant: string;
  subject: string;
  rarity: string;
  imageUrl: string;
}

export function cardFormFrom(card: AdminCardDetail): CardForm {
  return {
    name: card.name,
    cardNumber: card.cardNumber,
    variant: card.variant,
    subject: card.subject ?? '',
    rarity: card.rarity ?? '',
    imageUrl: card.imageUrl ?? '',
  };
}

export function validateCardForm(form: CardForm): Errors<keyof CardForm> {
  const errors: Errors<keyof CardForm> = {};
  const name = form.name.trim();
  if (!name || name.length > 120) errors.name = 'Name must be 1–120 characters';
  const number = form.cardNumber.trim();
  if (!number || number.length > 32) errors.cardNumber = 'Number must be 1–32 characters';
  if (form.variant.trim().length > 80) errors.variant = 'Variant is at most 80 characters';
  if (form.subject.trim().length > 120) errors.subject = 'Subject is at most 120 characters';
  if (form.rarity.trim().length > 40) errors.rarity = 'Rarity is at most 40 characters';
  const url = form.imageUrl.trim();
  if (url && (!HTTP_URL.test(url) || url.length > 500)) errors.imageUrl = 'Use a full http(s) link';
  return errors;
}

export function diffCard(card: AdminCardDetail, form: CardForm, reason: string): AdminUpdateCardRequest {
  const body: AdminUpdateCardRequest = {};
  const name = form.name.trim();
  if (name !== card.name) body.name = name;
  const cardNumber = form.cardNumber.trim();
  if (cardNumber !== card.cardNumber) body.cardNumber = cardNumber;
  // variant is a plain string ('' = none); the other text fields are nullable
  const variant = form.variant.trim();
  if (variant !== card.variant) body.variant = variant;
  if (orNull(form.subject) !== (card.subject ?? null)) body.subject = orNull(form.subject);
  if (orNull(form.rarity) !== (card.rarity ?? null)) body.rarity = orNull(form.rarity);
  if (orNull(form.imageUrl) !== (card.imageUrl ?? null)) body.imageUrl = orNull(form.imageUrl);
  if (Object.keys(body).length > 0 && reason.trim()) body.reason = reason.trim();
  return body;
}
