import type { Prisma } from '@prisma/client';
import type { AdminUserPermissions, UserRole } from '@card-trader/shared';

export interface Actor {
  userId: string;
  role: UserRole;
}

/**
 * The super admin is invisible to normal admins: every admin query that can
 * return or count accounts goes through this filter, so it never appears in
 * lists, search, counts or direct lookups (those answer 404 like an unknown id).
 */
export function visibleAccounts(viewer: Actor): Prisma.UserWhereInput {
  return viewer.role === 'SUPER_ADMIN' ? {} : { role: { not: 'SUPER_ADMIN' } };
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
