import type { Prisma } from '@prisma/client';
import type { AdminUserPermissions, UserRole } from '@card-trader/shared';

export interface Actor {
  userId: string;
  role: UserRole;
}

/**
 * Every admin query that can return or count accounts goes through this filter,
 * so a hidden account never appears in lists, search, counts or direct lookups
 * (those answer 404 like an unknown id):
 *   - super admins are invisible to normal admins;
 *   - accounts marked `hiddenFromAdmins` (the owner) are invisible to everyone but themselves,
 *     other super admins included.
 */
export function visibleAccounts(viewer: Actor): Prisma.UserWhereInput {
  const notHidden: Prisma.UserWhereInput = { OR: [{ hiddenFromAdmins: false }, { id: viewer.userId }] };
  return viewer.role === 'SUPER_ADMIN' ? notHidden : { AND: [{ role: { not: 'SUPER_ADMIN' } }, notHidden] };
}

/** Same rule for a single account already loaded (audit actors and targets). */
export function isVisibleTo(viewer: Actor, account: { id: string; role: UserRole; hiddenFromAdmins: boolean }): boolean {
  if (account.id === viewer.userId) return true;
  if (account.hiddenFromAdmins) return false;
  return viewer.role === 'SUPER_ADMIN' || account.role !== 'SUPER_ADMIN';
}

/**
 * What `viewer` may do to `target`. The API enforces exactly this; screens use
 * the same answer to show or hide buttons.
 *
 *   ADMIN        → USER accounts: edit, reset password, block/unblock. Admins: view only.
 *   SUPER_ADMIN  → USER and ADMIN accounts: all of that plus role changes.
 *   Nobody       → changes their own role or status, or acts on a SUPER_ADMIN (other than
 *                  the super admin editing their own profile).
 */
export function permissionsFor(viewer: Actor, target: { id: string; role: UserRole }): AdminUserPermissions {
  const self = viewer.userId === target.id;
  const isSuper = viewer.role === 'SUPER_ADMIN';

  if (target.role === 'SUPER_ADMIN') {
    return { editProfile: isSuper && self, changeRole: false, resetPassword: false, block: false };
  }
  const manageable = isSuper ? target.role === 'USER' || target.role === 'ADMIN' : target.role === 'USER';
  return {
    editProfile: manageable || self,
    changeRole: isSuper && !self && manageable,
    resetPassword: manageable && !self,
    block: manageable && !self,
  };
}

/** Audit action names, kept stable for filtering. */
export const AuditAction = {
  USER_UPDATED: 'USER_UPDATED',
  VENDOR_UPDATED: 'VENDOR_UPDATED',
  USER_PASSWORD_RESET: 'USER_PASSWORD_RESET',
  USER_DISABLED: 'USER_DISABLED',
  USER_ENABLED: 'USER_ENABLED',
  ADMIN_CREATED: 'ADMIN_CREATED',
  ADMIN_ROLE_CHANGED: 'ADMIN_ROLE_CHANGED',
  ADMIN_REMOVED: 'ADMIN_REMOVED',
  ADMIN_DISABLED: 'ADMIN_DISABLED',
  ADMIN_ENABLED: 'ADMIN_ENABLED',
  ANNOUNCEMENT_SENT: 'ANNOUNCEMENT_SENT',
} as const;
