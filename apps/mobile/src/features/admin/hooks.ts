import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminAuditQuery,
  AdminBlockRequest,
  AdminBroadcastRequest,
  AdminCardDetail,
  AdminCardListQuery,
  AdminChangeRoleRequest,
  AdminCreateAdminRequest,
  AdminResetPasswordRequest,
  AdminTradeListQuery,
  AdminUpdateCardRequest,
  AdminUpdateUserRequest,
  AdminUpdateVendorRequest,
  AdminUserDetail,
  AdminUserListQuery,
} from '@card-trader/shared';
import { api } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';

export const useAdminOverview = () => useQuery({ queryKey: queryKeys.adminOverview, queryFn: api.admin.overview });

export const useAdminUserList = (filters: AdminUserListQuery) =>
  useInfiniteQuery({
    queryKey: queryKeys.adminUserList(filters),
    queryFn: ({ pageParam }) => api.admin.users(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const useAdminUser = (publicId: string) =>
  useQuery({ queryKey: queryKeys.adminUser(publicId), queryFn: () => api.admin.user(publicId) });

export const useAdminUserCollection = (publicId: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: queryKeys.adminUserCollection(publicId),
    queryFn: ({ pageParam }) => api.admin.userCollection(publicId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });

export const useAdminUserTrades = (publicId: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: queryKeys.adminUserTrades(publicId),
    queryFn: ({ pageParam }) => api.admin.userTrades(publicId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });

export const useAdminUserReviews = (publicId: string, enabled = true) =>
  useQuery({ queryKey: queryKeys.adminUserReviews(publicId), queryFn: () => api.admin.userReviews(publicId), enabled });

export const useAdminUserHistory = (publicId: string, enabled = true) =>
  useQuery({ queryKey: queryKeys.adminUserHistory(publicId), queryFn: () => api.admin.userHistory(publicId), enabled });

export const useAdminTradeList = (filters: AdminTradeListQuery) =>
  useInfiniteQuery({
    queryKey: queryKeys.adminTradeList(filters),
    queryFn: ({ pageParam }) => api.admin.trades(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const useAdminTrade = (tradeId: string) =>
  useQuery({ queryKey: queryKeys.adminTrade(tradeId), queryFn: () => api.admin.trade(tradeId) });

export const useAdminCardList = (filters: AdminCardListQuery) =>
  useInfiniteQuery({
    queryKey: queryKeys.adminCardList(filters),
    queryFn: ({ pageParam }) => api.admin.cards(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const useAdminCard = (cardId: string) =>
  useQuery({ queryKey: queryKeys.adminCard(cardId), queryFn: () => api.admin.card(cardId) });

export const useAdminAnalytics = () => useQuery({ queryKey: queryKeys.adminAnalytics, queryFn: api.admin.analytics });

/** Writes the server's user back into the detail cache; lists, history and totals refetch. */
function useUserSaved(publicId: string) {
  const client = useQueryClient();
  return (user: AdminUserDetail) => {
    client.setQueryData(queryKeys.adminUser(publicId), user);
    void client.invalidateQueries({ queryKey: ['admin', 'users', 'list'] });
    void client.invalidateQueries({ queryKey: queryKeys.adminUserHistory(publicId) });
    void client.invalidateQueries({ queryKey: queryKeys.adminOverview });
    void client.invalidateQueries({ queryKey: queryKeys.adminAnalytics });
    void client.invalidateQueries({ queryKey: queryKeys.adminAudit });
  };
}

export function useAdminUpdateUser(publicId: string) {
  const onSuccess = useUserSaved(publicId);
  return useMutation({ mutationFn: (body: AdminUpdateUserRequest) => api.admin.updateUser(publicId, body), onSuccess });
}

export function useAdminUpdateVendor(publicId: string) {
  const onSuccess = useUserSaved(publicId);
  return useMutation({ mutationFn: (body: AdminUpdateVendorRequest) => api.admin.updateVendor(publicId, body), onSuccess });
}

export function useAdminUpdateCard(cardId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminUpdateCardRequest) => api.admin.updateCard(cardId, body),
    onSuccess: (card: AdminCardDetail) => {
      client.setQueryData(queryKeys.adminCard(cardId), card);
      void client.invalidateQueries({ queryKey: ['admin', 'cards', 'list'] });
      void client.invalidateQueries({ queryKey: queryKeys.adminAnalytics });
    },
  });
}

export function useAdminChangeRole(publicId: string) {
  const onSuccess = useUserSaved(publicId);
  return useMutation({ mutationFn: (body: AdminChangeRoleRequest) => api.admin.changeRole(publicId, body), onSuccess });
}

/** The password only lives in the mutation variables; callers clear their fields on success. */
export function useAdminResetPassword(publicId: string) {
  const onSuccess = useUserSaved(publicId);
  return useMutation({ mutationFn: (body: AdminResetPasswordRequest) => api.admin.resetPassword(publicId, body), onSuccess });
}

export function useAdminBlock(publicId: string, blocked: boolean) {
  const onSuccess = useUserSaved(publicId);
  return useMutation({
    mutationFn: (body: AdminBlockRequest) => (blocked ? api.admin.block(publicId, body) : api.admin.unblock(publicId, body)),
    onSuccess,
  });
}

export function useAdminCreateAdmin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminCreateAdminRequest) => api.admin.createAdmin(body),
    onSuccess: (user) => {
      client.setQueryData(queryKeys.adminUser(user.publicId), user);
      void client.invalidateQueries({ queryKey: ['admin', 'users', 'list'] });
      void client.invalidateQueries({ queryKey: queryKeys.adminOverview });
      void client.invalidateQueries({ queryKey: queryKeys.adminAnalytics });
      void client.invalidateQueries({ queryKey: queryKeys.adminAudit });
    },
  });
}

export const useAdminAuditLog = (filters: AdminAuditQuery) =>
  useInfiniteQuery({
    queryKey: queryKeys.adminAuditList(filters),
    queryFn: ({ pageParam }) => api.admin.audit(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export function useAdminBroadcast() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminBroadcastRequest) => api.admin.broadcast(body),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.adminAudit }),
  });
}
