import { create } from 'zustand';

interface AuthNoticeState {
  /** Shown on the sign-in screen, e.g. "Your account has been blocked…" after a forced sign-out. */
  notice: string | null;
  /** Show the "check your inbox" screen once, right after creating an account. */
  verifyEmailIntro: boolean;
  /** The Discover reminder was dismissed for this app session. */
  verifyBannerDismissed: boolean;

  setNotice: (notice: string | null) => void;
  setVerifyEmailIntro: (show: boolean) => void;
  dismissVerifyBanner: () => void;
}

/** Messages and one-off prompts around signing in (not persisted). */
export const useAuthNotice = create<AuthNoticeState>((set) => ({
  notice: null,
  verifyEmailIntro: false,
  verifyBannerDismissed: false,

  setNotice: (notice) => set({ notice }),
  setVerifyEmailIntro: (verifyEmailIntro) => set({ verifyEmailIntro }),
  dismissVerifyBanner: () => set({ verifyBannerDismissed: true }),
}));
