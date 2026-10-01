import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { Errors } from '../errors/app.exception';
import type { AccessTokenPayload, AuthUser } from './auth-user';
import { ALLOW_PASSWORD_CHANGE_PENDING_KEY, IS_PUBLIC_KEY } from './decorators';

export const ACCOUNT_BLOCKED_MESSAGE = 'Your account has been blocked. Please contact support.';
export const ACCOUNT_DISABLED_MESSAGE = 'This account has been disabled. Please contact support.';

/** Error for a non-ACTIVE account, shared by sign-in and every authenticated request. */
export function inactiveAccountError(status: string) {
  return status === 'BLOCKED'
    ? Errors.forbidden('ACCOUNT_BLOCKED', ACCOUNT_BLOCKED_MESSAGE)
    : Errors.forbidden('ACCOUNT_DISABLED', ACCOUNT_DISABLED_MESSAGE);
}

/** Global guard: every route requires a valid access token unless marked @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw Errors.unauthorized('AUTH_REQUIRED');

    const token = header.slice('Bearer '.length).trim();
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, { algorithms: ['HS256'] });
    } catch {
      throw Errors.unauthorized('ACCESS_TOKEN_INVALID', 'Access token is invalid or expired');
    }
    if (payload.typ !== 'access' || typeof payload.sub !== 'string' || typeof payload.pid !== 'string') {
      throw Errors.unauthorized('ACCESS_TOKEN_INVALID', 'Access token is invalid or expired');
    }

    // One primary-key lookup per request: blocking, a password reset or a
    // demotion applies at once instead of when the access token expires.
    const account = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { status: true, role: true, passwordChangedAt: true, mustChangePassword: true },
    });
    if (!account) throw Errors.unauthorized('ACCESS_TOKEN_INVALID', 'Access token is invalid or expired');
    if (account.status !== 'ACTIVE') throw inactiveAccountError(account.status);
    // Seconds resolution: a token issued in the same second as the change is kept,
    // so the session that just changed the password stays signed in.
    if (account.passwordChangedAt && (payload.iat ?? 0) < Math.floor(account.passwordChangedAt.getTime() / 1000)) {
      throw Errors.unauthorized('ACCESS_TOKEN_INVALID', 'Your password changed. Please sign in again.');
    }
    if (account.mustChangePassword && !this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE_PENDING_KEY, targets)) {
      throw Errors.forbidden('PASSWORD_CHANGE_REQUIRED', 'Choose a new password to continue');
    }

    request.user = { userId: payload.sub, publicId: payload.pid, role: account.role };
    return true;
  }
}
