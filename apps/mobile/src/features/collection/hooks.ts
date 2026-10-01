import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { CreateCollectionItemRequest, UpdateCollectionItemRequest, ValueRange } from '@card-trader/shared';
import { api, type CollectionFilters } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';

/** Collection changes affect portfolio totals and any trade that includes the card. */
export function invalidateCollection(client: QueryClient): Promise<unknown> {
  return Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.collection }),
    client.invalidateQueries({ queryKey: queryKeys.portfolio }),
    client.invalidateQueries({ queryKey: queryKeys.trades }),
  ]);
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
      return invalidateCollection(client);
    },
  });
}

export function useDeleteItem(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.collection.remove(id),
    onSuccess: () => {
      client.removeQueries({ queryKey: queryKeys.collectionItem(id) });
      return invalidateCollection(client);
    },
  });
}
