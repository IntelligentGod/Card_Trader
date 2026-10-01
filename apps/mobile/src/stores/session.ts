import { create } from 'zustand';
import type { AuthTokens, MeResponse } from '@card-trader/shared';

export type SessionStatus = 'booting' | 'signedOut' | 'signedIn';

interface SessionState {
  status: SessionStatus;
  user: MeResponse | null;
  /** Access token is kept in memory only. */
  accessToken: string | null;
  accessTokenExpiresAt: number;
  /** A scanned/opened profile link received while signed out. */
  pendingPublicId: string | null;
  /** True when the session was restored from cache without reaching the server. */
  offline: boolean;

  setSignedIn: (user: MeResponse, tokens: Pick<AuthTokens, 'accessToken' | 'accessTokenExpiresIn'> | null, offline?: boolean) => void;
  setAccessToken: (tokens: Pick<AuthTokens, 'accessToken' | 'accessTokenExpiresIn'>) => void;
  setUser: (user: MeResponse) => void;
  setSignedOut: () => void;
  setPendingPublicId: (publicId: string | null) => void;
}

export const useSession = create<SessionState>((set) => ({
  status: 'booting',
  user: null,
  accessToken: null,
  accessTokenExpiresAt: 0,
  pendingPublicId: null,
  offline: false,

  setSignedIn: (user, tokens, offline = false) =>
    set({
      status: 'signedIn',
      user,
      offline,
      accessToken: tokens?.accessToken ?? null,
      accessTokenExpiresAt: tokens ? Date.now() + tokens.accessTokenExpiresIn * 1000 : 0,
    }),
  setAccessToken: (tokens) =>
    set({
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: Date.now() + tokens.accessTokenExpiresIn * 1000,
      offline: false,
    }),
  setUser: (user) => set({ user }),
  setSignedOut: () => set({ status: 'signedOut', user: null, accessToken: null, accessTokenExpiresAt: 0, offline: false }),
  setPendingPublicId: (pendingPublicId) => set({ pendingPublicId }),
}));
