import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef } from 'react';
import { ACTIVE_TRADE_STATUSES, type TradeResponse } from '@card-trader/shared';
import { api } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import { invalidateCollection } from '../collection/hooks';

export const useTradeList = (scope: 'active' | 'history') =>
  useInfiniteQuery({
    queryKey: queryKeys.tradeList(scope),
    queryFn: ({ pageParam }) => api.trades.list(scope, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** A completed trade moved cards (and maybe cash) between both traders. */
function invalidateAfterCompletion(client: QueryClient): void {
  invalidateCollection(client);
  void client.invalidateQueries({ queryKey: queryKeys.me });
}

/**
 * Both traders stand face to face and edit the same trade, so an open trade
 * polls every few seconds while its screen is focused (no push in the MVP).
 */
export function useTrade(tradeId: string) {
  const client = useQueryClient();
  const focused = useIsFocused();
  const query = useQuery({
    queryKey: queryKeys.trade(tradeId),
    queryFn: () => api.trades.get(tradeId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return focused && status && ACTIVE_TRADE_STATUSES.includes(status) ? 4000 : false;
    },
  });

  // Only the trader whose confirmation completes the trade gets the COMPLETED response from
  // useTradeAction; the other one sees it here through polling and must refresh too.
  const status = query.data?.status;
  const previousStatus = useRef(status);
  useEffect(() => {
    const before = previousStatus.current;
    previousStatus.current = status;
    if (status === 'COMPLETED' && before !== undefined && before !== 'COMPLETED') invalidateAfterCompletion(client);
  }, [status, client]);

  return query;
}

/** Wraps a trade action: writes the server's authoritative response into the cache. */
export function useTradeAction<TVariables = void>(tradeId: string, action: (variables: TVariables) => Promise<TradeResponse>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: (trade) => {
      client.setQueryData(queryKeys.trade(tradeId), trade);
      void client.invalidateQueries({ queryKey: ['trades', 'list'] });
      if (trade.status === 'COMPLETED') invalidateAfterCompletion(client);
    },
    onError: () => {
      // Terms may have changed under us (409 version mismatch): show the latest.
      void client.invalidateQueries({ queryKey: queryKeys.trade(tradeId) });
    },
  });
}
