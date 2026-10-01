import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { Platform, TurboModuleRegistry } from 'react-native';
import type { AppleSignInRequest } from '@card-trader/shared';

/**
 * Google and Apple sign-in, shared by sign-in, sign-up and Settings → Security
 * (linking). Each provider is offered only when it can actually work here:
 * Google needs its client IDs and the native module (absent in Expo Go and
 * Jest), Apple needs iOS 13+.
 */

/** A failure worth showing as-is (not a server error, not a cancel). */
export class SocialSignInError extends Error {
  override name = 'SocialSignInError';
}

type GoogleModule = typeof import('@react-native-google-signin/google-signin');

let google: GoogleModule | null = null;

/** app.json: ["@react-native-google-signin/google-signin", { "iosUrlScheme": "com.googleusercontent.apps.…" }] */
function hasGoogleIosUrlScheme(): boolean {
  const plugins = Constants.expoConfig?.plugins ?? [];
  return plugins.some(
    (plugin) =>
      Array.isArray(plugin) &&
      plugin[0] === '@react-native-google-signin/google-signin' &&
      typeof (plugin[1] as { iosUrlScheme?: unknown } | undefined)?.iosUrlScheme === 'string',
  );
}

/** Loads and configures the Google module, or null when it isn't usable in this build. */
function loadGoogle(): GoogleModule | null {
  if (google) return google;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (!webClientId) return null;
  // iOS can't start the flow without its own client ID (no GoogleService-Info.plist here) and the
  // reversed-client-ID URL scheme from the config plugin; without it the native SDK crashes.
  if (Platform.OS === 'ios' && (!iosClientId || !hasGoogleIosUrlScheme())) return null;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  try {
    // Importing the library calls TurboModuleRegistry.getEnforcing and throws without the native
    // module, so check first and require lazily.
    if (!TurboModuleRegistry.get('RNGoogleSignin')) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-google-signin/google-signin') as GoogleModule;
    // webClientId makes the ID token's audience the Web client, which the server accepts.
    mod.GoogleSignin.configure({ webClientId, iosClientId });
    google = mod;
    return mod;
  } catch {
    return null;
  }
}

export function isGoogleSignInAvailable(): boolean {
  return loadGoogle() !== null;
}

/** Runs the Google account picker. Resolves null when the user cancels. */
export async function getGoogleIdToken(): Promise<string | null> {
  const mod = loadGoogle();
  if (!mod) throw new SocialSignInError('Google sign-in isn’t available on this device.');
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = mod;
  try {
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;
    // Our server issues the session; forgetting Google's makes the account picker show next time.
    void GoogleSignin.signOut().catch(() => undefined);
    if (!response.data.idToken) throw new SocialSignInError('Google didn’t return a sign-in token. Please try again.');
    return response.data.idToken;
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS) return null;
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new SocialSignInError('Google Play services are missing or out of date on this device.');
      }
    }
    throw error;
  }
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/** 32 random bytes as lowercase hex. */
export function randomNonce(byteCount = 32): string {
  return Array.from(Crypto.getRandomBytes(byteCount), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Apple puts whatever nonce we send into the identity token; we send the
 * SHA-256 of a raw nonce and give the server the raw one to check against.
 */
export async function createAppleNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = randomNonce();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw, { encoding: Crypto.CryptoEncoding.HEX });
  return { raw, hashed: hashed.toLowerCase() };
}

/** Runs Sign in with Apple. Resolves null when the user cancels. */
export async function getAppleCredential(): Promise<AppleSignInRequest | null> {
  const nonce = await createAppleNonce();
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: nonce.hashed,
    });
    if (!credential.identityToken) throw new SocialSignInError('Apple didn’t return a sign-in token. Please try again.');
    // Apple shares the name only the first time; the server keeps it for new accounts.
    const name = credential.fullName;
    const fullName = name && (name.givenName || name.familyName) ? { givenName: name.givenName, familyName: name.familyName } : null;
    return { identityToken: credential.identityToken, nonce: nonce.raw, fullName };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') return null;
    throw error;
  }
}
