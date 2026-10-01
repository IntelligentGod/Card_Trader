import type { CardCategory } from '@card-trader/shared';

export const colors = {
  background: '#F5F6FA',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF0F6',
  border: '#E3E6EF',
  text: '#0E1328',
  textMuted: '#646B84',
  textSubtle: '#9AA0B5',
  primary: '#4B3FE0',
  primaryPressed: '#3A2FC4',
  primarySoft: '#ECEAFF',
  positive: '#12A150',
  positiveSoft: '#E4F7EC',
  negative: '#DE3B3B',
  negativeSoft: '#FDEAEA',
  warning: '#D98A00',
  warningSoft: '#FFF4DC',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(14, 19, 40, 0.55)',
} as const;

export const categoryColors: Record<CardCategory, { main: string; soft: string }> = {
  POKEMON: { main: '#F2A900', soft: '#FFF5D6' },
  ONE_PIECE: { main: '#E0443E', soft: '#FDE7E6' },
  SPORTS: { main: '#2C6BE6', soft: '#E4EDFF' },
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

export const shadow = {
  shadowColor: '#1B2150',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;
