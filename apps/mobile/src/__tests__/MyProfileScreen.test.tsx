import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { MeResponse } from '@card-trader/shared';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { api } from '../api/endpoints';
import { MyProfileScreen } from '../features/profile/MyProfileScreen';
import type { TabScreenProps } from '../navigation/types';
import { useSession } from '../stores/session';

jest.mock('../api/endpoints', () => ({ api: { users: { me: jest.fn(), reviews: jest.fn() } } }));
const me = api.users.me as jest.MockedFunction<typeof api.users.me>;
const reviews = api.users.reviews as jest.MockedFunction<typeof api.users.reviews>;

const user = (role: MeResponse['role']): MeResponse => ({
  publicId: 'AbCdEfGhIjKl',
  email: 'tom@example.com',
  role,
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
});

const navigate = jest.fn();
const props = { navigation: { navigate }, route: { key: 'Profile', name: 'Profile' } } as unknown as TabScreenProps<'Profile'>;

async function renderAs(role: MeResponse['role']) {
  me.mockResolvedValue(user(role));
  reviews.mockResolvedValue({ data: [], nextCursor: null });
  useSession.getState().setSignedIn(user(role), null);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <QueryClientProvider client={client}>
        <MyProfileScreen {...props} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  // Let both queries (and the session mirror of /users/me) settle inside act.
  await waitFor(() => expect(client.isFetching()).toBe(0));
  expect(screen.getByText('Complete a trade to receive your first review.')).toBeTruthy();
}

describe('MyProfileScreen admin entry', () => {
  beforeEach(() => navigate.mockReset());

  it('is hidden for regular users', async () => {
    await renderAs('USER');
    expect(screen.queryByTestId('admin-console')).toBeNull();
    expect(screen.queryByText('Admin console')).toBeNull();
  });

  it('opens the console for admins', async () => {
    await renderAs('ADMIN');
    fireEvent.press(screen.getByTestId('admin-console'));
    expect(navigate).toHaveBeenCalledWith('AdminHome');
  });

  it('is shown for the super admin too', async () => {
    await renderAs('SUPER_ADMIN');
    expect(screen.getByTestId('admin-console')).toBeTruthy();
  });
});
