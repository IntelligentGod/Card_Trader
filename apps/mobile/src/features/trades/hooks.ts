import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { ACTIVE_TRADE_STATUSES, type TradeResponse } from '@card-trader/shared';
import { api } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';

export const useTradeList = (scope: 'active' | 'history') =>
  useInfiniteQuery({
    queryKey: queryKeys.tradeList(scope),
    queryFn: ({ pageParam }) => api.trades.list(scope, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/**
 * Both traders stand face to face and edit the same trade, so an open trade
 * polls every few seconds while its screen is focused (no push in the MVP).
 */
export function useTrade(tradeId: string) {
  const focused = useIsFocused();
  return useQuery({
    queryKey: queryKeys.trade(tradeId),
    queryFn: () => api.trades.get(tradeId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return focused && status && ACTIVE_TRADE_STATUSES.includes(status) ? 4000 : false;
    },
  });
}

/** Wraps a trade action: writes the server's authoritative response into the cache. */
export function useTradeAction<TVariables = void>(tradeId: string, action: (variables: TVariables) => Promise<TradeResponse>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: (trade) => {
      client.setQueryData(queryKeys.trade(tradeId), trade);
      void client.invalidateQueries({ queryKey: ['trades', 'list'] });
      if (trade.status === 'COMPLETED') {
        void client.invalidateQueries({ queryKey: queryKeys.collection });
        void client.invalidateQueries({ queryKey: queryKeys.portfolio });
        void client.invalidateQueries({ queryKey: queryKeys.me });
      }
    },
    onError: () => {
      // Terms may have changed under us (409 version mismatch): show the latest.
      void client.invalidateQueries({ queryKey: queryKeys.trade(tradeId) });
    },
  });
}
