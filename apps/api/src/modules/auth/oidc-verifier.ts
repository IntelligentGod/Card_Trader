import { Inject, Injectable, Logger } from '@nestjs/common';
import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { Errors } from '../../common/errors/app.exception';
import { sha256Hex } from '../../common/utils/ids';
import { AppConfig } from '../../config/app-config.service';

/** The signing keys used to check ID tokens. Production fetches (and caches) the providers' published JWKS. */
export interface OidcKeySources {
  google: JWTVerifyGetKey;
  apple: JWTVerifyGetKey;
}
export const OIDC_KEY_SOURCES = Symbol('OIDC_KEY_SOURCES');

export const remoteOidcKeySources = (): OidcKeySources => ({
  google: createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs')),
  apple: createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys')),
});

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const APPLE_ISSUER = 'https://appleid.apple.com';

export interface VerifiedIdentity {
  provider: 'GOOGLE' | 'APPLE';
  /** stable provider user id ("sub") */
  subject: string;
  email: string | null;
  /** the provider vouches that the user controls this email */
  emailVerified: boolean;
  name: string | null;
}

/**
 * Verifies Google and Apple ID tokens on the server: RS256 signature against
 * the provider's keys, issuer, audience (our client ids), expiry, and for
 * Apple the nonce. Nothing from the token is trusted before this passes.
 */
@Injectable()
export class OidcVerifier {
  private readonly logger = new Logger(OidcVerifier.name);

  constructor(
    @Inject(OIDC_KEY_SOURCES) private readonly keys: OidcKeySources,
    private readonly config: AppConfig,
  ) {}

  async google(idToken: string): Promise<VerifiedIdentity> {
    const audience = this.config.googleClientIds;
    if (audience.length === 0) throw Errors.unprocessable('GOOGLE_NOT_CONFIGURED', 'Google sign-in is not set up on this server');
    const claims = await this.verify(idToken, this.keys.google, { issuer: GOOGLE_ISSUERS, audience });
    return {
      provider: 'GOOGLE',
      subject: requireSubject(claims),
      email: typeof claims.email === 'string' ? claims.email.toLowerCase() : null,
      emailVerified: claims.email_verified === true || claims.email_verified === 'true',
      name: typeof claims.name === 'string' ? claims.name : null,
    };
  }

  /**
   * `rawNonce` is the value the app generated; the app sent SHA-256(rawNonce)
   * to Apple, which echoes it in the token. A token minted for another
   * request (replay) carries a different nonce and is refused.
   */
  async apple(identityToken: string, rawNonce: string): Promise<VerifiedIdentity> {
    const audience = this.config.appleClientIds;
    if (audience.length === 0) throw Errors.unprocessable('APPLE_NOT_CONFIGURED', 'Sign in with Apple is not set up on this server');
    const claims = await this.verify(identityToken, this.keys.apple, { issuer: APPLE_ISSUER, audience });
    if (typeof claims.nonce !== 'string' || claims.nonce !== sha256Hex(rawNonce)) {
      throw Errors.unauthorized('INVALID_PROVIDER_TOKEN', 'Sign in with Apple could not be verified');
    }
    return {
      provider: 'APPLE',
      subject: requireSubject(claims),
      email: typeof claims.email === 'string' ? claims.email.toLowerCase() : null,
      // Apple sends "true"/"false" strings; relay addresses (privaterelay.appleid.com) are verified too.
      emailVerified: claims.email_verified === true || claims.email_verified === 'true',
      name: null,
    };
  }

  private async verify(token: string, keys: JWTVerifyGetKey, options: { issuer: string | string[]; audience: string[] }): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, keys, { ...options, algorithms: ['RS256'], clockTolerance: 30 });
      return payload;
    } catch (error) {
      if (error instanceof joseErrors.JOSEError) {
        throw Errors.unauthorized('INVALID_PROVIDER_TOKEN', 'The sign-in could not be verified. Please try again.');
      }
      // Network failure fetching the provider's keys.
      this.logger.error(`Could not verify provider token: ${String(error)}`);
      throw Errors.unprocessable('PROVIDER_UNAVAILABLE', 'The sign-in provider could not be reached. Please try again.');
    }
  }
}

function requireSubject(claims: JWTPayload): string {
  if (typeof claims.sub !== 'string' || claims.sub.length === 0 || claims.sub.length > 255) {
    throw Errors.unauthorized('INVALID_PROVIDER_TOKEN', 'The sign-in could not be verified. Please try again.');
  }
  return claims.sub;
}
