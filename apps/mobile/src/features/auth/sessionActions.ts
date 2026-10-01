import { isTwoFactorChallenge, type AuthResponse, type LoginResponse, type MeResponse, type TwoFactorChallengeResponse } from '@card-trader/shared';
import { ApiError, refreshAccessToken, registerSessionHandlers } from '../../api/client';
import { api } from '../../api/endpoints';
import { queryClient } from '../../api/queryClient';
import { queryKeys } from '../../api/queryKeys';
import { useAuthNotice } from '../../stores/authNotice';
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
  queryClient.setQueryData(queryKeys.me, response.user);
  useAuthNotice.getState().setNotice(null);
  useSession.getState().setSignedIn(response.user, response.tokens);
}

/**
 * Every sign-in method (password, Google, Apple) may answer with a 2FA
 * challenge instead of a session; the caller then asks for the code.
 */
export async function finishLogin(response: LoginResponse, onChallenge: (challenge: TwoFactorChallengeResponse) => void): Promise<void> {
  if (isTwoFactorChallenge(response)) onChallenge(response);
  else await completeSignIn(response);
}

let meInFlight: Promise<MeResponse> | null = null;

/** Refetches /users/me into the query cache, the session store and the offline cache (single-flight). */
export function refreshMe(): Promise<MeResponse> {
  if (!meInFlight) {
    meInFlight = (async () => {
      const me = await api.users.me();
      if (useSession.getState().status === 'signedIn') {
        queryClient.setQueryData(queryKeys.me, me);
        useSession.getState().setUser(me);
        await secureStorage.setCachedUser(me);
      }
      return me;
    })().finally(() => {
      meInFlight = null;
    });
  }
  return meInFlight;
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

/** Signs out locally (the server already ended the session) and explains why on the sign-in screen. */
async function endSession(message: string): Promise<void> {
  useAuthNotice.getState().setNotice(message);
  if (useSession.getState().status === 'signedOut') return;
  useSession.getState().setSignedOut();
  queryClient.clear();
  await secureStorage.clear();
}

registerSessionHandlers({
  onAccountClosed: (message) => void endSession(message),
  onPasswordChangeRequired: () => void refreshMe().catch(() => undefined),
  onSessionEnded: (message) => useAuthNotice.getState().setNotice(message),
});
