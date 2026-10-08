import type { UserRole } from '@card-trader/shared';

/** Identity attached to the request by JwtAuthGuard. */
export interface AuthUser {
  userId: string;
  publicId: string;
  /** read from the database on every request, so a role change applies at once */
  role: UserRole;
  /** paid, admin, or the paywall is off (see full-access.ts); read from the database on every request */
  hasFullAccess: boolean;
}

export interface AccessTokenPayload {
  sub: string;
  pid: string;
  typ: 'access';
  /** issued-at (seconds), set by the JWT library */
  iat?: number;
}
