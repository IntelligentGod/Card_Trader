import { create } from 'zustand';

interface AuthNoticeState {
  /** Shown on the sign-in screen, e.g. "Your account has been blocked…" after a forced sign-out. */
  notice: string | null;

  setNotice: (notice: string | null) => void;
}

/** Messages around signing in (not persisted). */
export const useAuthNotice = create<AuthNoticeState>((set) => ({
  notice: null,

  setNotice: (notice) => set({ notice }),
}));
