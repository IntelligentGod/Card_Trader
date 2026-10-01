import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { MeResponse } from '@card-trader/shared';
import { queryClient } from '../../api/queryClient';
import { queryKeys } from '../../api/queryKeys';
import { api } from '../../api/endpoints';
import { secureStorage } from '../../stores/secureStorage';
import { useSession } from '../../stores/session';
import { refreshMe } from './sessionActions';

/** Sends the verification link again (429 RESEND_TOO_SOON / RESEND_LIMIT carry a readable message). */
export const useResendVerification = () => useMutation({ mutationFn: api.auth.resendVerification });

/** Applies a MeResponse returned by a security action (link/unlink, 2FA) everywhere. */
export function applyMe(me: MeResponse): void {
  queryClient.setQueryData(queryKeys.me, me);
  useSession.getState().setUser(me);
  void secureStorage.setCachedUser(me);
}

/**
 * Picks up changes made outside the app — mainly the email verification link
 * opened in the browser — by refetching /users/me on return to the foreground.
 */
export function useRefreshMeOnForeground(): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const { status, offline } = useSession.getState();
      if (state === 'active' && status === 'signedIn' && !offline) void refreshMe().catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);
}
