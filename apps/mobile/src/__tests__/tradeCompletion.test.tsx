import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { TradeResponse, TradeStatus } from '@card-trader/shared';
import { api } from '../api/endpoints';
import { queryKeys } from '../api/queryKeys';
import { useTrade } from '../features/trades/hooks';

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('../api/endpoints', () => ({ api: { trades: { get: jest.fn() } } }));
const getTrade = api.trades.get as jest.MockedFunction<typeof api.trades.get>;

const trade = (status: TradeStatus) => ({ id: 't1', status }) as unknown as TradeResponse;

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(() => useTrade('t1'), { wrapper });
  return { client, invalidate, hook };
}

const invalidatedKeys = (invalidate: jest.SpyInstance) => invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));

describe('useTrade', () => {
  beforeEach(() => getTrade.mockReset());

  it('refreshes the collection and dashboard when polling sees the other trader complete the trade', async () => {
    getTrade.mockResolvedValue(trade('ACCEPTED'));
    const { client, invalidate, hook } = setup();
    await waitFor(() => expect(hook.result.current.data?.status).toBe('ACCEPTED'));
    expect(invalidatedKeys(invalidate)).not.toContain(JSON.stringify(queryKeys.portfolio));

    getTrade.mockResolvedValue(trade('COMPLETED'));
    await act(() => client.refetchQueries({ queryKey: queryKeys.trade('t1') }));

    await waitFor(() => expect(invalidatedKeys(invalidate)).toContain(JSON.stringify(queryKeys.portfolio)));
    expect(invalidatedKeys(invalidate)).toEqual(expect.arrayContaining([JSON.stringify(queryKeys.collection), JSON.stringify(queryKeys.me)]));
  });

  it('does not refresh again when opening a trade that was already completed', async () => {
    getTrade.mockResolvedValue(trade('COMPLETED'));
    const { invalidate, hook } = setup();
    await waitFor(() => expect(hook.result.current.data?.status).toBe('COMPLETED'));
    expect(invalidatedKeys(invalidate)).not.toContain(JSON.stringify(queryKeys.portfolio));
  });
});
