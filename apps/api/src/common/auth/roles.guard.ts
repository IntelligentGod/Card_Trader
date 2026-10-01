import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { UserRole } from '@card-trader/shared';
import { Errors } from '../errors/app.exception';
import type { AuthUser } from './auth-user';
import { IS_PUBLIC_KEY, ROLES_KEY } from './decorators';

/**
 * Global guard, registered after JwtAuthGuard: enforces @Roles / @AdminOnly /
 * @SuperAdminOnly. The role comes from the database on every request (the
 * JWT guard loads it), so a demotion applies at once.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles || roles.length === 0) return true;
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) {
      throw new Error('A route cannot be both @Public and role-restricted');
    }
    const user = context.switchToHttp().getRequest<Request & { user?: AuthUser }>().user;
    if (!user) throw Errors.unauthorized('AUTH_REQUIRED');
    if (!roles.includes(user.role)) {
      // Non-admins only learn that admin routes exist, not which are super-admin only.
      throw user.role !== 'USER' && !roles.includes('ADMIN')
        ? Errors.forbidden('SUPER_ADMIN_ONLY', 'Only the super admin can use this')
        : Errors.forbidden('ADMIN_ONLY', 'Only admins can use this');
    }
    return true;
  }
}
