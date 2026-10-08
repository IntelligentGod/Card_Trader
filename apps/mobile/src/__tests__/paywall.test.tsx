import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { BillingStatusResponse, MeResponse } from '@card-trader/shared';
import { ApiError } from '../api/client';
import { api } from '../api/endpoints';
import { PaywallScreen } from '../features/billing/PaywallScreen';
import { useSession } from '../stores/session';

jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('../api/endpoints', () => ({ api: { billing: { status: jest.fn(), sync: jest.fn() } } }));
jest.mock('../features/auth/sessionActions', () => ({ signOut: jest.fn(async () => undefined) }));

const status = api.billing.status as jest.MockedFunction<typeof api.billing.status>;
const sync = api.billing.sync as jest.MockedFunction<typeof api.billing.sync>;

const me = (hasFullAccess: boolean): MeResponse => ({
  publicId: 'AbCdEfGhIjKl',
  email: 'tom@example.com',
  role: 'USER',
  emailVerified: true,
  twoFactorEnabled: false,
  mustChangePassword: false,
  hasPassword: true,
  authProviders: ['PASSWORD'],
  hasFullAccess,
  username: 'tom',
  displayName: 'Tom',
  bio: null,
  avatarUrl: null,
  location: null,
  socialLinks: {},
  vendor: null,
  stats: { ratingAverage: null, ratingCount: 0, completedTradeCount: 0 },
  createdAt: '2026-09-30T00:00:00Z',
});
const locked: BillingStatusResponse = { hasFullAccess: false, paywallEnabled: true, storeConfigured: false, entitlementId: 'full_access', paidAt: null, paidVia: null };

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <QueryClientProvider client={client}>
        <PaywallScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('PaywallScreen', () => {
  beforeEach(() => {
    status.mockReset();
    sync.mockReset();
    useSession.getState().setSignedIn(me(false), null);
  });

  it('shows the price and explains that the store is not set up in this build', async () => {
    status.mockResolvedValue(locked);
    renderScreen();
    expect(screen.getByText('Unlock Card Trader')).toBeTruthy();
    expect(screen.getByText('$4.99')).toBeTruthy();
    expect(await screen.findByTestId('paywall-unavailable')).toBeTruthy();
    // No store keys in tests: buying is off, but the account check and sign-out remain.
    expect(screen.getByTestId('paywall-buy')).toHaveProp('accessibilityState', expect.objectContaining({ disabled: true }));
    expect(screen.getByTestId('paywall-check')).toHaveProp('accessibilityState', expect.objectContaining({ disabled: false }));
    expect(screen.getByTestId('paywall-sign-out')).toBeTruthy();
  });

  it('"I already paid" asks the server, which unlocks the account', async () => {
    status.mockResolvedValue(locked);
    sync.mockResolvedValue(me(true));
    renderScreen();
    fireEvent.press(screen.getByTestId('paywall-check'));
    await waitFor(() => expect(sync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(useSession.getState().user?.hasFullAccess).toBe(true));
  });

  it('explains when the server finds no purchase for the account', async () => {
    status.mockResolvedValue(locked);
    sync.mockRejectedValue(new ApiError(402, 'PAYMENT_REQUIRED', 'No purchase was found for this account.'));
    renderScreen();
    fireEvent.press(screen.getByTestId('paywall-check'));
    expect(await screen.findByTestId('paywall-not-found')).toHaveTextContent('No purchase was found for this account.');
    expect(useSession.getState().user?.hasFullAccess).toBe(false);
  });
});
