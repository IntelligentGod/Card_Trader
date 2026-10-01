import * as SecureStore from 'expo-secure-store';
import type { MeResponse } from '@card-trader/shared';

/** Refresh token and a cached profile live only in the OS keychain/keystore. */
const REFRESH_TOKEN_KEY = 'ct.refreshToken';
const CACHED_USER_KEY = 'ct.user';

export const secureStorage = {
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string) => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token),

  async getCachedUser(): Promise<MeResponse | null> {
    const raw = await SecureStore.getItemAsync(CACHED_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as MeResponse;
    } catch {
      return null;
    }
  },
  setCachedUser: (user: MeResponse) => SecureStore.setItemAsync(CACHED_USER_KEY, JSON.stringify(user)),

  async clear(): Promise<void> {
    await Promise.all([SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY), SecureStore.deleteItemAsync(CACHED_USER_KEY)]);
  },
};
