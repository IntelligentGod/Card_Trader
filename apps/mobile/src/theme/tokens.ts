import type { CardCategory } from '@card-trader/shared';

/**
 * Design tokens. Colors live in themes (below) and are read with `useTheme()` or
 * `makeStyles()` from './themeStore'; everything else here is theme-independent.
 *
 * To add a theme: add its id to THEME_MODES, define an AppTheme, register it in `themes`
 * and give it a label in THEME_LABELS. Components need no changes.
 */

export interface ThemeColors {
  /** screen background */
  background: string;
  /** cards, sheets, tab bar */
  surface: string;
  /** chips, skeletons, pressed rows, secondary buttons */
  surfaceMuted: string;
  border: string;
  divider: string;
  inputBackground: string;
  /** primary text */
  text: string;
  /** secondary text */
  textMuted: string;
  /** hints, placeholders, inactive icons */
  textSubtle: string;
  icon: string;
  primary: string;
  primaryPressed: string;
  /** tinted backgrounds behind primary text/icons (selected states, badges) */
  primarySoft: string;
  /** text and icons on a `primary` background */
  onPrimary: string;
  /** second accent, for highlights that shouldn't compete with `primary` */
  secondary: string;
  positive: string;
  positiveSoft: string;
  negative: string;
  negativeSoft: string;
  warning: string;
  warningSoft: string;
  /** fixed colors that never change with the theme: content on colored backgrounds, QR codes, the camera view */
  white: string;
  black: string;
  /** dimmed backdrop behind modals and sheets */
  overlay: string;
}

export type CategoryColors = Record<CardCategory, { main: string; soft: string }>;

export interface ShadowStyle {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
}

/** The dashboard's value card: a brand gradient behind white text. */
export interface HeroColors {
  gradient: readonly [string, string, string];
  glow: string;
}

export const THEME_MODES = ['purple', 'dark'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export interface AppTheme {
  mode: ThemeMode;
  /** true for dark backgrounds: drives the status bar and the navigation theme */
  dark: boolean;
  colors: ThemeColors;
  categoryColors: CategoryColors;
  shadow: ShadowStyle;
  hero: HeroColors;
  /** top → bottom screen gradient drawn behind every screen; null = solid `colors.background` */
  backgroundGradient: readonly [string, string] | null;
}

/** Purple Mode (default): a soft lavender gradient behind white surfaces, purple as the accent, dark-purple text. */
export const purpleTheme: AppTheme = {
  mode: 'purple',
  dark: false,
  colors: {
    background: '#F7F4FD',
    surface: '#FFFFFF',
    surfaceMuted: '#F0ECF9',
    border: '#E6E0F2',
    divider: '#EEE9F7',
    inputBackground: '#FFFFFF',
    text: '#1C1530',
    textMuted: '#655E7D',
    textSubtle: '#8A83A2',
    icon: '#4A4262',
    primary: '#6D3BE8',
    primaryPressed: '#5A2BCC',
    primarySoft: '#EFE8FF',
    onPrimary: '#FFFFFF',
    secondary: '#D946EF',
    positive: '#12A150',
    positiveSoft: '#E4F7EC',
    negative: '#DE3B3B',
    negativeSoft: '#FDEAEA',
    warning: '#C27C00',
    warningSoft: '#FFF4DC',
    white: '#FFFFFF',
    black: '#000000',
    overlay: 'rgba(28, 21, 48, 0.55)',
  },
  categoryColors: {
    POKEMON: { main: '#E5A000', soft: '#FFF5D6' },
    ONE_PIECE: { main: '#E0443E', soft: '#FDE7E6' },
    SPORTS: { main: '#2C6BE6', soft: '#E4EDFF' },
  },
  shadow: { shadowColor: '#2A1B5E', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  hero: { gradient: ['#5B2BD9', '#7442EC', '#A784FF'], glow: '#4A1FC0' },
  // Lavender at the top fading to the solid background; cards stay white on top of it.
  backgroundGradient: ['#E4D7FF', '#F7F4FD'],
};

/** Dark Mode: deep purple-tinted charcoal, lighter raised surfaces, purple stays the accent. */
export const darkTheme: AppTheme = {
  mode: 'dark',
  dark: true,
  colors: {
    background: '#0F0D16',
    surface: '#1A1724',
    surfaceMuted: '#252131',
    border: '#2F2A3E',
    divider: '#28243A',
    inputBackground: '#211D2D',
    text: '#F2F0F8',
    textMuted: '#ABA5BE',
    textSubtle: '#7B7591',
    icon: '#C9C4D8',
    primary: '#A585FA',
    primaryPressed: '#9070F2',
    primarySoft: '#2B2246',
    // Light purple accent with dark text on it: the only way both purple links on dark cards
    // and labels on purple buttons stay readable (WCAG AA).
    onPrimary: '#170F2E',
    secondary: '#E879F9',
    positive: '#3DCB82',
    positiveSoft: '#14301F',
    negative: '#F26B6B',
    negativeSoft: '#3A1B1F',
    warning: '#F2B43C',
    warningSoft: '#3A2D12',
    white: '#FFFFFF',
    black: '#000000',
    overlay: 'rgba(0, 0, 0, 0.65)',
  },
  categoryColors: {
    POKEMON: { main: '#F5B82E', soft: '#3A2F12' },
    ONE_PIECE: { main: '#F0625C', soft: '#3B1D1C' },
    SPORTS: { main: '#5B8DF5', soft: '#1B2945' },
  },
  // Shadows barely read on dark backgrounds; surfaces are separated by tone and borders instead.
  shadow: { shadowColor: '#000000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  // Deeper than Purple Mode so the card doesn't glare against the dark screen.
  hero: { gradient: ['#341A80', '#4A27B0', '#6A45D6'], glow: '#000000' },
  backgroundGradient: null,
};

export const themes: Record<ThemeMode, AppTheme> = { purple: purpleTheme, dark: darkTheme };
export const DEFAULT_THEME_MODE: ThemeMode = 'purple';
export const THEME_LABELS: Record<ThemeMode, { title: string; description: string }> = {
  purple: { title: 'Purple Mode', description: 'Light and bright with purple accents' },
  dark: { title: 'Dark Mode', description: 'Easy on the eyes in low light' },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;

export const typography = {
  display: { fontSize: 36, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400' },
  bodyStrong: { fontSize: 15, fontWeight: '600' },
  caption: { fontSize: 13, fontWeight: '400' },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
} as const;
