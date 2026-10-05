import * as SecureStore from 'expo-secure-store';
import { StyleSheet } from 'react-native';
import { create } from 'zustand';
import { DEFAULT_THEME_MODE, THEME_MODES, themes, type AppTheme, type ThemeMode } from './tokens';

const THEME_MODE_KEY = 'ct.themeMode';

interface ThemeState {
  mode: ThemeMode;
  /** false until the saved choice has been read at start-up */
  hydrated: boolean;
  setMode: (mode: ThemeMode) => void;
}

const useThemeStore = create<ThemeState>((set) => ({
  mode: DEFAULT_THEME_MODE,
  hydrated: false,
  setMode: (mode) => {
    set({ mode });
    // A failed write only means the default comes back on the next launch.
    SecureStore.setItemAsync(THEME_MODE_KEY, mode).catch(() => undefined);
  },
}));

const isThemeMode = (value: string | null): value is ThemeMode => THEME_MODES.includes(value as ThemeMode);

/** Restores the saved theme. Called once before the first screen renders. */
export async function hydrateThemeMode(): Promise<void> {
  try {
    const saved = await SecureStore.getItemAsync(THEME_MODE_KEY);
    if (isThemeMode(saved)) useThemeStore.setState({ mode: saved });
  } catch {
    // Unreadable storage: keep the default theme.
  } finally {
    useThemeStore.setState({ hydrated: true });
  }
}

/** The active theme: `const { colors } = useTheme();` */
export const useTheme = (): AppTheme => themes[useThemeStore((s) => s.mode)];

/** The selected mode and how to change it (theme selector). */
export function useThemeMode(): { mode: ThemeMode; setMode: (mode: ThemeMode) => void; hydrated: boolean } {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const hydrated = useThemeStore((s) => s.hydrated);
  return { mode, setMode, hydrated };
}

/**
 * Theme-aware StyleSheet. Declare at module level like `StyleSheet.create`, call the
 * returned hook in the component:
 *
 *   const useStyles = makeStyles(({ colors }) => ({ box: { backgroundColor: colors.surface } }));
 *   function Box() { const styles = useStyles(); … }
 *
 * Each theme's sheet is built once and cached, so switching themes stays cheap.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (theme: AppTheme) => T & StyleSheet.NamedStyles<any>,
): () => T {
  const cache = new Map<ThemeMode, T>();
  return function useStyles(): T {
    const theme = useTheme();
    let styles = cache.get(theme.mode);
    if (!styles) {
      styles = StyleSheet.create(factory(theme));
      cache.set(theme.mode, styles);
    }
    return styles;
  };
}
