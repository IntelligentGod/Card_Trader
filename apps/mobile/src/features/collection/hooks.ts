import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { CreateCollectionItemRequest, UpdateCollectionItemRequest, ValueRange } from '@card-trader/shared';
import { api, type CollectionFilters } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';

/**
 * Anything that changes what a user owns or lists (add/edit/remove a card, a completed trade,
 * event inventory) affects the collection, the dashboard totals, open trades and the public
 * profile's listings. Fire-and-forget: callers must not wait for every screen to refetch.
 */
export function invalidateCollection(client: QueryClient): void {
  for (const queryKey of [queryKeys.collection, queryKeys.portfolio, queryKeys.trades, ['users']]) {
    void client.invalidateQueries({ queryKey });
  }
}

export const useCollectionList = (filters: CollectionFilters) =>
  useInfiniteQuery({
    queryKey: queryKeys.collectionList(filters),
    queryFn: ({ pageParam }) => api.collection.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const useCollectionItem = (id: string) =>
  useQuery({ queryKey: queryKeys.collectionItem(id), queryFn: () => api.collection.get(id) });

export const useItemMarketValue = (id: string) =>
  useQuery({ queryKey: queryKeys.collectionMarket(id), queryFn: () => api.collection.marketValue(id) });

export const useItemPriceHistory = (id: string, range: ValueRange) =>
  useQuery({
    queryKey: queryKeys.collectionHistory(id, range),
    queryFn: () => api.collection.priceHistory(id, range),
    placeholderData: (previous) => previous,
  });

export function useCreateItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCollectionItemRequest) => api.collection.create(body),
    onSuccess: () => invalidateCollection(client),
  });
}

export function useUpdateItem(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateCollectionItemRequest) => api.collection.update(id, body),
    onSuccess: (item) => {
      client.setQueryData(queryKeys.collectionItem(id), item);
      invalidateCollection(client);
    },
  });
}

export function useDeleteItem(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.collection.remove(id),
    onSuccess: () => {
      client.removeQueries({ queryKey: queryKeys.collectionItem(id) });
      invalidateCollection(client);
    },
  });
}
