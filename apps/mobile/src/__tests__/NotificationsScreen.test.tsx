import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import type { NotificationResponse, Paginated } from '@card-trader/shared';
import { api } from '../api/endpoints';
import { queryKeys } from '../api/queryKeys';
import { NotificationsScreen } from '../features/notifications/NotificationsScreen';
import type { RootScreenProps } from '../navigation/types';

jest.mock('../api/endpoints', () => ({
  api: {
    notifications: {
      recent: jest.fn(),
      unreadCount: jest.fn(async () => ({ count: 7 })),
      markOneRead: jest.fn(async () => ({ count: 6 })),
      markAllRead: jest.fn(async () => ({ count: 0 })),
    },
  },
}));
const recent = api.notifications.recent as jest.MockedFunction<typeof api.notifications.recent>;
const markOneRead = api.notifications.markOneRead as jest.MockedFunction<typeof api.notifications.markOneRead>;

function renderScreen(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity }, mutations: { retry: false } } });
  // Seeded so the badge query doesn't resolve (and re-render) after the assertions.
  client.setQueryData(queryKeys.unreadCount, { count: 7 });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const item = (i: number): NotificationResponse => ({
  id: `n${i}`,
  type: 'TRADE_OFFER',
  title: `Offer ${i}`,
  body: `Someone sent you offer ${i}`,
  data: { tradeId: `t${i}` },
  isRead: i > 3,
  readAt: i > 3 ? '2026-10-01T09:00:00.000Z' : null,
  createdAt: `2026-10-01T10:0${i}:00.000Z`,
});

const page = (count: number, nextCursor: string | null): Paginated<NotificationResponse> => ({
  data: Array.from({ length: count }, (_, i) => item(i + 1)),
  nextCursor,
});

const navigation = { navigate: jest.fn(), setOptions: jest.fn() };
const props = { navigation, route: { key: 'Notifications', name: 'Notifications' } } as unknown as RootScreenProps<'Notifications'>;

describe('NotificationsScreen (recent)', () => {
  beforeEach(() => {
    recent.mockReset();
    navigation.navigate.mockReset();
    markOneRead.mockClear();
  });

  it('shows at most 6 and offers "Show all" when there are more', async () => {
    recent.mockResolvedValue(page(7, 'cursor-6'));
    renderScreen(<NotificationsScreen {...props} />);
    expect(await screen.findByText('Offer 1')).toBeTruthy();
    expect(screen.getByText('Offer 6')).toBeTruthy();
    expect(screen.queryByText('Offer 7')).toBeNull();
    expect(recent).toHaveBeenCalledWith(6);

    fireEvent.press(screen.getByTestId('notifications-show-all'));
    expect(navigation.navigate).toHaveBeenCalledWith('NotificationHistory');
  });

  it('has no "Show all" when everything fits', async () => {
    recent.mockResolvedValue(page(3, null));
    renderScreen(<NotificationsScreen {...props} />);
    expect(await screen.findByText('Offer 3')).toBeTruthy();
    expect(screen.queryByTestId('notifications-show-all')).toBeNull();
  });

  it('marks an unread notification read and opens its trade', async () => {
    recent.mockResolvedValue(page(2, null));
    renderScreen(<NotificationsScreen {...props} />);
    fireEvent.press(await screen.findByTestId('notification-n1'));
    await waitFor(() => expect(markOneRead).toHaveBeenCalledWith('n1'));
    expect(navigation.navigate).toHaveBeenCalledWith('TradeConfirmation', { tradeId: 't1' });
  });
});
