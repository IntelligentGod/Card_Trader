import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError } from '../api/client';
import { api } from '../api/endpoints';
import { LoginScreen } from '../features/auth/screens/LoginScreen';
import type { RootScreenProps } from '../navigation/types';
import { useAuthNotice } from '../stores/authNotice';
import { useSession } from '../stores/session';

jest.mock('../api/endpoints', () => ({ api: { auth: { login: jest.fn() } } }));
const login = api.auth.login as jest.MockedFunction<typeof api.auth.login>;

function renderScreen(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </SafeAreaProvider>,
  );
}

const props = { navigation: { navigate: jest.fn() }, route: { key: 'Login', name: 'Login' } } as unknown as RootScreenProps<'Login'>;

describe('LoginScreen', () => {
  beforeEach(() => {
    login.mockReset();
    useSession.getState().setSignedOut();
    useAuthNotice.getState().setNotice(null);
    (props.navigation.navigate as jest.Mock).mockClear();
  });

  it('validates before calling the API', () => {
    renderScreen(<LoginScreen {...props} />);
    fireEvent.press(screen.getByTestId('login-submit'));
    expect(screen.getByText('Enter a valid email address')).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
  });

  it('signs in and stores the session', async () => {
    login.mockResolvedValue({
      user: {
        publicId: 'AbCdEfGhIjKl',
        email: 'tom@example.com',
        role: 'USER',
        username: 'tom',
        displayName: 'Tom',
        bio: null,
        avatarUrl: null,
        location: null,
        socialLinks: {},
        vendor: null,
        stats: { ratingAverage: null, ratingCount: 0, completedTradeCount: 0 },
        emailVerified: true,
        twoFactorEnabled: false,
        mustChangePassword: false,
  hasFullAccess: true,
        hasPassword: true,
        authProviders: ['PASSWORD'],
        createdAt: '2026-09-30T00:00:00Z',
      },
      tokens: { accessToken: 'access', refreshToken: 'refresh-token-value', accessTokenExpiresIn: 900 },
    });
    renderScreen(<LoginScreen {...props} />);
    fireEvent.changeText(screen.getByTestId('login-email'), ' tom@example.com ');
    fireEvent.changeText(screen.getByTestId('login-password'), 'Tr4ding-Cards-Rock');
    fireEvent.press(screen.getByTestId('login-submit'));

    await waitFor(() => expect(useSession.getState().status).toBe('signedIn'));
    expect(login).toHaveBeenCalledWith({ email: 'tom@example.com', password: 'Tr4ding-Cards-Rock' });
    expect(useSession.getState().accessToken).toBe('access');
  });

  it('shows the server error message', async () => {
    login.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'));
    renderScreen(<LoginScreen {...props} />);
    fireEvent.changeText(screen.getByTestId('login-email'), 'tom@example.com');
    fireEvent.changeText(screen.getByTestId('login-password'), 'wrong');
    fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByTestId('login-error')).toHaveTextContent('Invalid email or password');
  });

  it('asks for the 2FA code instead of signing in when challenged', async () => {
    login.mockResolvedValue({ twoFactorRequired: true, challengeToken: 'challenge', expiresIn: 300 });
    renderScreen(<LoginScreen {...props} />);
    fireEvent.changeText(screen.getByTestId('login-email'), 'tom@example.com');
    fireEvent.changeText(screen.getByTestId('login-password'), 'Tr4ding-Cards-Rock');
    fireEvent.press(screen.getByTestId('login-submit'));

    await waitFor(() => expect(props.navigation.navigate).toHaveBeenCalledWith('TwoFactorVerify', { challengeToken: 'challenge', expiresIn: 300 }));
    expect(useSession.getState().status).toBe('signedOut');
  });

  it('explains why the last session ended', () => {
    useAuthNotice.getState().setNotice('Your account has been blocked. Please contact support.');
    renderScreen(<LoginScreen {...props} />);
    expect(screen.getByTestId('login-notice')).toHaveTextContent(/Your account has been blocked\. Please contact support\./);
  });

  it('hides Google sign-in when no client ID is configured', () => {
    expect(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).toBeUndefined();
    renderScreen(<LoginScreen {...props} />);
    expect(screen.queryByTestId('google-sign-in')).toBeNull();
  });
});
