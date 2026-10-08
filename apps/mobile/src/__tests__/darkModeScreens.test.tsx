import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import type { ComponentType, ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { MeResponse } from '@card-trader/shared';
import { Button } from '../components/Button';
import { Chip, Segmented, TextField } from '../components/Controls';
import { ListingBadge } from '../components/ListingBadge';
import { PriceText } from '../components/PriceText';
import { SkeletonList } from '../components/Skeleton';
import { EmptyState, ErrorState } from '../components/States';
import { Surface } from '../components/Surface';
import { TrendBadge } from '../components/TrendBadge';
import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { RegisterScreen } from '../features/auth/screens/RegisterScreen';
import { SplashScreen } from '../features/auth/screens/SplashScreen';
import { HelpCenterScreen } from '../features/help/HelpCenterScreen';
import { MyProfileScreen } from '../features/profile/MyProfileScreen';
import { SettingsScreen } from '../features/profile/SettingsScreen';
import { SecurityScreen } from '../features/security/SecurityScreen';
import { useSession } from '../stores/session';
import { darkTheme, purpleTheme, useThemeMode } from '../theme';

// Every API call resolves to an empty page (and /users/me to the signed-in user), so screens
// render their real layout without a server.
jest.mock('../api/endpoints', () => ({
  api: new Proxy(
    {},
    {
      get: (_, group) =>
        new Proxy({}, { get: (__, call) => jest.fn(async () => (group === 'users' && call === 'me' ? mockMe : { data: [], nextCursor: null, count: 0 })) }),
    },
  ),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }),
  useIsFocused: () => true,
  useFocusEffect: () => undefined,
}));

const mockMe: MeResponse = {
  publicId: 'AbCdEfGhIjKl',
  email: 'tom@example.com',
  role: 'ADMIN',
  emailVerified: true,
  twoFactorEnabled: false,
  mustChangePassword: false,
  hasFullAccess: true,
  hasPassword: true,
  authProviders: ['PASSWORD'],
  username: 'tom',
  displayName: 'Tom',
  bio: null,
  avatarUrl: null,
  location: null,
  socialLinks: {},
  vendor: null,
  stats: { ratingAverage: null, ratingCount: 0, completedTradeCount: 0 },
  createdAt: '2026-09-30T00:00:00Z',
};

/** Colors that exist only in Purple Mode: seeing one in Dark Mode means something wasn't migrated. */
const fixed = new Set([purpleTheme.colors.white, purpleTheme.colors.black].map((c) => c.toLowerCase()));
const darkValues = new Set(Object.values(darkTheme.colors).map((c) => c.toLowerCase()));
const PURPLE_ONLY = new Set(
  Object.values(purpleTheme.colors)
    .map((c) => c.toLowerCase())
    .filter((c) => !darkValues.has(c) && !fixed.has(c)),
);
const COLOR_PROPS = /(color|fill|stroke|tint)$/i;

/** Every color in the rendered tree that belongs to Purple Mode only, with where it was found. */
function purpleLeaks(): string[] {
  const leaks: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    const { type, props, children } = node as { type: string; props: Record<string, unknown>; children?: unknown[] };
    // The theme selector previews each theme in its own colors on purpose.
    if (props?.testID === 'theme-preview') return;
    const check = (key: string, value: unknown) => {
      if (typeof value === 'string' && COLOR_PROPS.test(key) && PURPLE_ONLY.has(value.toLowerCase())) leaks.push(`<${type}> ${key}=${value}`);
    };
    for (const [key, value] of Object.entries(props ?? {})) {
      if (key === 'style') Object.entries(StyleSheet.flatten(value as never) ?? {}).forEach(([k, v]) => check(k, v));
      else check(key, value);
    }
    children?.forEach(visit);
  };
  visit(screen.toJSON());
  return leaks;
}

const nav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) };
const screenProps = (name: string) => ({ navigation: nav, route: { key: name, name, params: {} } });

async function renderDark(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } } });
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(client.isFetching()).toBe(0));
}

describe('Dark Mode: no Purple Mode colors left on screen', () => {
  beforeAll(() => {
    useSession.getState().setSignedIn(mockMe, null);
    const { result } = renderHook(() => useThemeMode());
    act(() => result.current.setMode('dark'));
  });
  afterAll(() => {
    const { result } = renderHook(() => useThemeMode());
    act(() => result.current.setMode('purple'));
  });

  const screens: [string, ComponentType<any>][] = [
    ['Splash', SplashScreen],
    ['Login', LoginScreen],
    ['Register', RegisterScreen],
    ['Profile', MyProfileScreen],
    ['Settings', SettingsScreen],
    ['Security', SecurityScreen],
    ['HelpCenter', HelpCenterScreen],
  ];

  it.each(screens)('%s screen', async (name, Screen) => {
    await renderDark(<Screen {...screenProps(name)} />);
    expect(purpleLeaks()).toEqual([]);
  });

  it('the scan itself works: it reports Purple Mode colors when Purple Mode is on', async () => {
    const { result } = renderHook(() => useThemeMode());
    act(() => result.current.setMode('purple'));
    try {
      await renderDark(<Button title="Save" onPress={() => undefined} />);
      expect(purpleLeaks()).toContain(`<View> backgroundColor=${purpleTheme.colors.primary}`);
    } finally {
      act(() => result.current.setMode('dark'));
    }
  });

  it('shared components: buttons, inputs, chips, badges, cards and empty/error/loading states', async () => {
    await renderDark(
      <>
        {(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant) => (
          <Button key={variant} title={variant} variant={variant} onPress={() => undefined} />
        ))}
        <Button title="disabled" disabled onPress={() => undefined} />
        <TextField label="Name" placeholder="Type here" error="Required" />
        <Chip label="Chip" selected onPress={() => undefined} />
        <Segmented options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} value="a" onChange={() => undefined} />
        <Surface>
          <PriceText cents={1234} />
          <PriceText cents={null} />
        </Surface>
        <ListingBadge status="FOR_SALE" askingPriceCents={500} />
        <TrendBadge amountCents={640} percent={8.2} />
        <TrendBadge amountCents={-20} percent={-1.5} />
        <EmptyState icon="search" title="Nothing here" message="Try again" />
        <ErrorState error={new Error('boom')} onRetry={() => undefined} />
        <SkeletonList rows={2} />
      </>,
    );
    expect(purpleLeaks()).toEqual([]);
  });
});
