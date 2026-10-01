import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API base URL resolution:
 *  1. EXPO_PUBLIC_API_URL (explicit, e.g. staging/production)
 *  2. the Metro dev-server host (so a phone on the same Wi-Fi reaches your PC)
 *  3. emulator defaults
 */
function resolveApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') return `http://${host}:3000/api/v1`;

  return Platform.OS === 'android' ? 'http://10.0.2.2:3000/api/v1' : 'http://localhost:3000/api/v1';
}

export const API_URL = resolveApiUrl();

const API_ORIGIN = /^https?:\/\/[^/]+/.exec(API_URL)?.[0] ?? '';

/**
 * In local dev the API builds media URLs from PUBLIC_BASE_URL, which defaults
 * to localhost — unreachable from an emulator or phone. Serve loopback media
 * from the same host the app already uses for the API.
 */
export function mediaUrl(url: string): string;
export function mediaUrl(url: string | null | undefined): string | null;
export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?=\/)/, API_ORIGIN);
}
export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
