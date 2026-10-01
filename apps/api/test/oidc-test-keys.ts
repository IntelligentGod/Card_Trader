import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK, type KeyLike } from 'jose';
import type { OidcKeySources } from '../src/modules/auth/oidc-verifier';

/**
 * Real RS256 keys generated for the test run, standing in for Google's and
 * Apple's published key sets. The production verifier runs unchanged; only
 * where it fetches public keys from differs.
 */
export interface TestIdentityProviders {
  keys: OidcKeySources;
  googleToken(claims: Record<string, unknown>, options?: { audience?: string; issuer?: string; expiresIn?: string; signWith?: 'google' | 'apple' | 'stranger' }): Promise<string>;
  appleToken(claims: Record<string, unknown>, options?: { audience?: string; expiresIn?: string }): Promise<string>;
}

async function keyPair(kid: string): Promise<{ privateKey: KeyLike; jwk: JWK }> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  return { privateKey, jwk: { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' } };
}

export async function createTestIdentityProviders(): Promise<TestIdentityProviders> {
  const google = await keyPair('google-test');
  const apple = await keyPair('apple-test');
  // Not in any published key set: a token signed by an attacker.
  const stranger = await keyPair('google-test');

  const sign = (key: KeyLike, kid: string, claims: Record<string, unknown>, issuer: string, audience: string, expiresIn: string) =>
    new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid }).setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime(expiresIn).sign(key);

  return {
    keys: {
      google: createLocalJWKSet({ keys: [google.jwk] }),
      apple: createLocalJWKSet({ keys: [apple.jwk] }),
    },
    googleToken: (claims, options = {}) => {
      const signer = options.signWith === 'stranger' ? stranger : options.signWith === 'apple' ? apple : google;
      return sign(
        signer.privateKey,
        String(signer.jwk.kid),
        claims,
        options.issuer ?? 'https://accounts.google.com',
        options.audience ?? 'test-google-client.apps.googleusercontent.com',
        options.expiresIn ?? '10m',
      );
    },
    appleToken: (claims, options = {}) =>
      sign(apple.privateKey, 'apple-test', claims, 'https://appleid.apple.com', options.audience ?? 'com.cardtrader.app', options.expiresIn ?? '10m'),
  };
}
