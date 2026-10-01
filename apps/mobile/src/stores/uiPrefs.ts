import { create } from 'zustand';
import type { ValueRange } from '@card-trader/shared';

interface UiPrefsState {
  chartRange: ValueRange;
  setChartRange: (range: ValueRange) => void;
}

/** Lightweight local UI preferences (not server state). */
export const useUiPrefs = create<UiPrefsState>((set) => ({
  chartRange: '30d',
  setChartRange: (chartRange) => set({ chartRange }),
}));
