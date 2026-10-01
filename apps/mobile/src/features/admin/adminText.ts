import {
  CONDITION_LABELS,
  formatCents,
  VENDOR_APPLICATION_LABELS,
  type AdminAuditEntry,
  type AdminAuditQuery,
  type AuthProviderType,
  type AdminUserEvent,
  type CatalogSource,
  type CollectionItemResponse,
  type EventStatus,
  type TradeCash,
  type UserRole,
  type UserStatus,
} from '@card-trader/shared';

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  USER: 'User',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super admin',
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Active',
  BLOCKED: 'Blocked',
  DISABLED: 'Disabled',
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  CANCELLED: 'Cancelled',
};

/** Neutral (third-person) cash line: "Tom pays Bob $20" / "Bob pays Tom $15 (agreed)" / "No cash". */
export function adminCashText(cash: TradeCash, initiatorName: string, counterpartyName: string): string {
  if (!cash.payer || cash.amountCents === 0) return cash.isManual ? 'No cash (agreed)' : 'No cash';
  const [payer, payee] = cash.payer === 'INITIATOR' ? [initiatorName, counterpartyName] : [counterpartyName, initiatorName];
  return `${payer} pays ${payee} ${formatCents(cash.amountCents)}${cash.isManual ? ' (agreed)' : ''}`;
}

/** "Oct 1, 2026, 3:04 PM" (device time zone) for audit timelines. */
export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** "PSA 10" for graded cards, else the condition label. */
export function gradeText(item: Pick<CollectionItemResponse, 'condition' | 'gradingCompany' | 'grade'>): string {
  if (item.condition === 'GRADED') {
    return [item.gradingCompany ?? 'Graded', item.grade ?? null].filter((part) => part !== null).join(' ');
  }
  return CONDITION_LABELS[item.condition];
}

/** "Organizer" / "Vendor · Approved · Table 12" / "Interested". */
export function eventRelationText(event: AdminUserEvent): string {
  switch (event.relation) {
    case 'ORGANIZER':
      return 'Organizer';
    case 'SAVED':
      return 'Interested';
    case 'VENDOR':
      return [
        'Vendor',
        event.vendorStatus ? VENDOR_APPLICATION_LABELS[event.vendorStatus] : null,
        event.tableNumber ? `Table ${event.tableNumber}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
  }
}

export const CATALOG_SOURCE_LABELS: Record<CatalogSource, string> = {
  SEED: 'Seed',
  IMPORT: 'Import',
  USER_SUBMITTED: 'User submitted',
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  USER_UPDATED: 'Profile edited',
  USER_DISABLED: 'User blocked',
  USER_ENABLED: 'User unblocked',
  USER_PASSWORD_RESET: 'Password reset',
  VENDOR_UPDATED: 'Vendor profile edited',
  ADMIN_CREATED: 'Admin created',
  ADMIN_ROLE_CHANGED: 'Made admin',
  ADMIN_REMOVED: 'Admin role removed',
  ADMIN_DISABLED: 'Admin blocked',
  ADMIN_ENABLED: 'Admin unblocked',
  CARD_UPDATED: 'Card edited',
  CARD_VERIFIED: 'Card verified',
  CARD_UNVERIFIED: 'Card unverified',
  ANNOUNCEMENT_SENT: 'Announcement sent',
};

export type AuditFilter = 'all' | 'accounts' | 'blocks' | 'passwords' | 'adminsAdded' | 'roles' | 'cards' | 'announcements';

/** Audit log filter chips → the API's single `action` / `targetType` params. */
export const AUDIT_FILTERS: { value: AuditFilter; label: string; query: AdminAuditQuery }[] = [
  { value: 'all', label: 'All', query: {} },
  { value: 'accounts', label: 'Accounts', query: { targetType: 'USER' } },
  { value: 'blocks', label: 'Blocks', query: { action: 'USER_DISABLED' } },
  { value: 'passwords', label: 'Passwords', query: { action: 'USER_PASSWORD_RESET' } },
  { value: 'adminsAdded', label: 'Admins added', query: { action: 'ADMIN_CREATED' } },
  { value: 'roles', label: 'Role changes', query: { action: 'ADMIN_ROLE_CHANGED' } },
  { value: 'cards', label: 'Cards', query: { targetType: 'CARD' } },
  { value: 'announcements', label: 'Announcements', query: { targetType: 'SYSTEM' } },
];

export function auditQueryFor(filter: AuditFilter): AdminAuditQuery {
  return AUDIT_FILTERS.find((f) => f.value === filter)?.query ?? {};
}

/** Actions by a hidden super admin come without identity. */
export function auditActorText(entry: Pick<AdminAuditEntry, 'admin'>): string {
  return entry.admin.publicId === null && entry.admin.email === null ? 'Administrator' : entry.admin.displayName;
}

/** "Yes"/"No" for account flags. */
export const yesNo = (value: boolean) => (value ? 'Yes' : 'No');

const PROVIDER_LABELS: Record<AuthProviderType, string> = { PASSWORD: 'Password', GOOGLE: 'Google', APPLE: 'Apple' };

export function signInMethodsText(providers: readonly AuthProviderType[]): string {
  return providers.length ? providers.map((p) => PROVIDER_LABELS[p]).join(', ') : 'None';
}

/** Known actions get a readable label; unknown ones fall back to "Some action". */
export function auditActionLabel(action: string): string {
  const known = AUDIT_ACTION_LABELS[action];
  if (known) return known;
  const words = action.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Audit values are arbitrary JSON: show short, readable text. */
export function auditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  const json = JSON.stringify(value);
  return json === '{}' || json === '[]' ? '—' : json;
}

/** ["email: a@x.com → b@x.com", …] in the order the API sent them. */
export function auditChangeLines(entry: Pick<AdminAuditEntry, 'changes'>): string[] {
  return Object.entries(entry.changes).map(([field, change]) => `${field}: ${auditValue(change.from)} → ${auditValue(change.to)}`);
}
