import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { UpdateMeRequest, UpsertVendorProfileRequest } from '@card-trader/shared';
import { api } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import { secureStorage } from '../../stores/secureStorage';
import { useSession } from '../../stores/session';

/** Server profile, mirrored into the session store (and the offline cache). */
export function useMe() {
  const setUser = useSession((s) => s.setUser);
  const query = useQuery({ queryKey: queryKeys.me, queryFn: api.users.me });
  useEffect(() => {
    if (query.data) {
      setUser(query.data);
      void secureStorage.setCachedUser(query.data);
    }
  }, [query.data, setUser]);
  return query;
}

export function useUpdateMe() {
  const client = useQueryClient();
  const setUser = useSession((s) => s.setUser);
  return useMutation({
    mutationFn: (body: UpdateMeRequest) => api.users.updateMe(body),
    onSuccess: (me) => {
      client.setQueryData(queryKeys.me, me);
      setUser(me);
      void secureStorage.setCachedUser(me);
    },
  });
}

/** Vendor Mode on/off + business details; same account, inventory and reviews. */
export function useUpsertVendor() {
  const client = useQueryClient();
  const setUser = useSession((s) => s.setUser);
  return useMutation({
    mutationFn: (body: UpsertVendorProfileRequest) => api.users.upsertVendor(body),
    onSuccess: (me) => {
      client.setQueryData(queryKeys.me, me);
      setUser(me);
      void secureStorage.setCachedUser(me);
      void client.invalidateQueries({ queryKey: queryKeys.events });
    },
  });
}
