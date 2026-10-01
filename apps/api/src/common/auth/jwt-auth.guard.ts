import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { Errors } from '../errors/app.exception';
import type { AccessTokenPayload, AuthUser } from './auth-user';
import { IS_PUBLIC_KEY } from './decorators';

/** Global guard: every route requires a valid access token unless marked @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

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

    request.user = { userId: payload.sub, publicId: payload.pid };
    return true;
  }
}
