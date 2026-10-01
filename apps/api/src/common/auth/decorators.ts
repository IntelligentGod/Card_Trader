import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { UserRole } from '@card-trader/shared';
import type { AuthUser } from './auth-user';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
export const ALLOW_PASSWORD_CHANGE_PENDING_KEY = 'allowPasswordChangePending';

/** Opt a route out of the global JWT guard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Only these roles may call the route (checked by the global RolesGuard on every request). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Admin console routes: ADMIN or SUPER_ADMIN. */
export const AdminOnly = () => Roles('ADMIN', 'SUPER_ADMIN');

/** Managing admins, the full audit log, announcements. */
export const SuperAdminOnly = () => Roles('SUPER_ADMIN');

/**
 * Routes a user may still call while an admin-reset password must be changed
 * (everything else answers 403 PASSWORD_CHANGE_REQUIRED).
 */
export const AllowWhilePasswordChangeRequired = () => SetMetadata(ALLOW_PASSWORD_CHANGE_PENDING_KEY, true);

/** Client IP for the audit log; honours TRUST_PROXY via Express's req.ip. */
export const ClientIp = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | null => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return request.ip ?? null;
});

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
  if (!request.user) {
    // Only reachable if a route is misconfigured as @Public() but reads the user.
    throw new Error('CurrentUser used on a route without authentication');
  }
  return request.user;
});
