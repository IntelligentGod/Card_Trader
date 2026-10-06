import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import type { MeResponse } from '@card-trader/shared';
import App from '../../App';
import { useSession } from '../stores/session';

/**
 * Boots the real App (navigation, session restore, theme restore, every tab) the way the
 * phone does. A crash on launch in the release build shows up here as a thrown render error.
 */

const mockMe: MeResponse = {
  publicId: 'AbCdEfGhIjKl',
  email: 'tom@example.com',
  role: 'ADMIN',
  emailVerified: true,
  twoFactorEnabled: false,
  mustChangePassword: false,
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

// Screen size and insets normally come from the OS; the library's test mock supplies them here.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
// The server answers the way an empty account's does: the calls Discover makes at start-up get
// their real shapes; every other call gets an empty page.
const mockChange = { amountCents: 0, percent: null };
const mockAnswers: Record<string, Record<string, unknown>> = {
  users: { me: mockMe },
  portfolio: {
    summary: {
      totalValueCents: 0,
      cardCount: 0,
      itemCount: 0,
      unpricedCount: 0,
      byCategory: [],
      change: { '1d': mockChange, '7d': mockChange, '30d': mockChange },
      disclaimer: 'Estimates only.',
    },
    history: { range: '30d', points: [] },
    topCards: [],
    movers: [],
  },
  notifications: { unreadCount: { count: 0 } },
};
jest.mock('../api/endpoints', () => ({
  api: new Proxy(
    {},
    {
      get: (_, group: string) =>
        new Proxy({}, { get: (__, call: string) => jest.fn(async () => mockAnswers[group]?.[call] ?? { data: [], nextCursor: null, count: 0 }) }),
    },
  ),
}));
jest.mock('../api/client', () => ({
  ...jest.requireActual('../api/client'),
  refreshAccessToken: jest.fn(async () => 'access-token'),
}));

async function boot() {
  render(<App />);
  // The app shows nothing until the saved theme is read, then a splash until the session is restored.
  await waitFor(() => expect(useSession.getState().status).not.toBe('booting'), { timeout: 5000 });
}

// The tab bar renders after the screens, so its button is the last match (Discover also has a "Trade with others" action).
const tab = (name: string) => screen.getAllByRole('button', { name }).at(-1)!;

describe('App boots on the phone', () => {
  afterEach(async () => {
    await SecureStore.deleteItemAsync('ct.themeMode');
    await act(async () => {
      await SecureStore.deleteItemAsync('ct.refreshToken');
      await SecureStore.deleteItemAsync('ct.user');
      useSession.getState().setSignedOut();
    });
  });

  it('signed out: shows the sign-in screen', async () => {
    await boot();
    expect(await screen.findByTestId('login-submit')).toBeTruthy();
  });

  it('signed in: restores the session, opens Discover and every other tab', async () => {
    await SecureStore.setItemAsync('ct.refreshToken', 'refresh-token');
    await boot();
    expect(await screen.findByText(/Tom/)).toBeTruthy();

    for (const name of ['Inventory', 'Trade', 'Events', 'Profile', 'Discover']) {
      await act(async () => fireEvent.press(tab(name)));
      expect(tab(name)).toBeTruthy();
    }
  });

  it('signed in with Dark Mode saved: boots in Dark Mode', async () => {
    await SecureStore.setItemAsync('ct.refreshToken', 'refresh-token');
    await SecureStore.setItemAsync('ct.themeMode', 'dark');
    await boot();
    expect(await screen.findByText(/Tom/)).toBeTruthy();
    await act(async () => fireEvent.press(tab('Profile')));
    await act(async () => fireEvent.press(await screen.findByText('Settings')));
    expect(screen.getByLabelText('Dark Mode')).toHaveProp('accessibilityState', { checked: true });
  });
});
