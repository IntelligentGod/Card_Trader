import type { AuthResponse } from '@card-trader/shared';
import { ApiError, refreshAccessToken } from '../../api/client';
import { api } from '../../api/endpoints';
import { queryClient } from '../../api/queryClient';
import { secureStorage } from '../../stores/secureStorage';
import { useSession } from '../../stores/session';

/**
 * Restores the session on app start. If the server is unreachable (poor signal
 * at a card show), the cached profile is used so "My QR" still works offline.
 */
export async function bootstrapSession(): Promise<void> {
  const session = useSession.getState();
  const refreshToken = await secureStorage.getRefreshToken();
  if (!refreshToken) {
    session.setSignedOut();
    return;
  }
  try {
    const accessToken = await refreshAccessToken();
    if (!accessToken) return; // refresh rejected → already signed out
    const me = await api.users.me();
    await secureStorage.setCachedUser(me);
    useSession.getState().setSignedIn(me, {
      accessToken,
      accessTokenExpiresIn: Math.max(0, (useSession.getState().accessTokenExpiresAt - Date.now()) / 1000),
    });
  } catch (error) {
    const cached = await secureStorage.getCachedUser();
    if (error instanceof ApiError && error.isNetwork && cached) {
      useSession.getState().setSignedIn(cached, null, true);
      return;
    }
    await secureStorage.clear();
    useSession.getState().setSignedOut();
  }
}

export async function completeSignIn(response: AuthResponse): Promise<void> {
  await secureStorage.setRefreshToken(response.tokens.refreshToken);
  await secureStorage.setCachedUser(response.user);
  useSession.getState().setSignedIn(response.user, response.tokens);
}

export async function signOut(): Promise<void> {
  const refreshToken = await secureStorage.getRefreshToken();
  if (refreshToken) {
    // Best effort: revoke server-side, but always clear locally.
    await api.auth.logout(refreshToken).catch(() => undefined);
  }
  await secureStorage.clear();
  queryClient.clear();
  useSession.getState().setSignedOut();
}
