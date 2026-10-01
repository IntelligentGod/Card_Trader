import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EventDetail, EventSearchQuery } from '@card-trader/shared';
import { api, type EventListFilters } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';

export const useEventList = (filters: EventListFilters) =>
  useInfiniteQuery({
    queryKey: queryKeys.eventList(filters),
    queryFn: ({ pageParam }) => api.events.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** An empty id (the "create" form) skips the request. */
export const useEvent = (eventId: string) =>
  useQuery({ queryKey: queryKeys.event(eventId), queryFn: () => api.events.get(eventId), enabled: eventId.length > 0 });

export const useEventSearch = (eventId: string, filters: EventSearchQuery) =>
  useInfiniteQuery({
    queryKey: queryKeys.eventSearch(eventId, filters),
    queryFn: ({ pageParam }) => api.events.search(eventId, filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** Any event mutation that returns the updated detail: cache it and refresh lists. */
export function useEventMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<EventDetail>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (event) => {
      client.setQueryData(queryKeys.event(event.id), event);
      void client.invalidateQueries({ queryKey: ['events', 'list'] });
    },
  });
}
