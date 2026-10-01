/** Identity attached to the request by JwtAuthGuard. */
export interface AuthUser {
  userId: string;
  publicId: string;
}

export interface AccessTokenPayload {
  sub: string;
  pid: string;
  typ: 'access';
}
