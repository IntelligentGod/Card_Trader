import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Errors } from '../errors/app.exception';
import type { AuthUser } from './auth-user';
import { ALLOW_WITHOUT_PURCHASE_KEY, IS_PUBLIC_KEY } from './decorators';

/**
 * Global guard, registered after RolesGuard: an account without full access (see
 * `hasFullAccess`, loaded by JwtAuthGuard) only reaches routes marked @AllowWithoutPurchase()
 * — its own profile, account security and billing — and gets 402 PAYMENT_REQUIRED elsewhere.
 * The app shows the unlock screen on that code.
 */
@Injectable()
export class PurchaseGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_WITHOUT_PURCHASE_KEY, targets)) return true;
    const user = context.switchToHttp().getRequest<Request & { user?: AuthUser }>().user;
    if (!user) throw Errors.unauthorized('AUTH_REQUIRED');
    if (!user.hasFullAccess) throw Errors.paymentRequired();
    return true;
  }
}
