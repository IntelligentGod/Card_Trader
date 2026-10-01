import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { VENDOR_APPLICATION_LABELS, type EventVendorResponse } from '@card-trader/shared';
import { errorMessage } from '../../../api/client';
import { api } from '../../../api/endpoints';
import { queryKeys } from '../../../api/queryKeys';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { TextField } from '../../../components/Controls';
import { Avatar } from '../../../components/Profile';
import { SkeletonList } from '../../../components/Skeleton';
import { EmptyState, ErrorState } from '../../../components/States';
import { Surface } from '../../../components/Surface';
import type { RootScreenProps } from '../../../navigation/types';
import { colors, spacing } from '../../../theme';
import { formatDateShort } from '../../../utils/format';

const STATUS_COLOR: Record<EventVendorResponse['status'], string> = {
  PENDING: colors.warning,
  APPROVED: colors.positive,
  DECLINED: colors.negative,
  WITHDRAWN: colors.textMuted,
};

/** Organizer: approve or decline vendors and assign table numbers. */
export function EventVendorsScreen({ route, navigation }: RootScreenProps<'EventVendors'>) {
  const { eventId } = route.params;
  const client = useQueryClient();
  const applications = useQuery({
    queryKey: queryKeys.eventApplications(eventId),
    queryFn: () => api.events.applications(eventId),
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: queryKeys.eventApplications(eventId) });
    void client.invalidateQueries({ queryKey: queryKeys.event(eventId) });
  };
  const approve = useMutation({
    mutationFn: ({ id, tableNumber }: { id: string; tableNumber: string }) => api.events.approve(eventId, id, { tableNumber }),
    onSuccess: refresh,
  });
  const decline = useMutation({ mutationFn: (id: string) => api.events.decline(eventId, id), onSuccess: refresh });

  if (applications.isPending) return <SkeletonList rows={4} />;
  if (applications.error) return <ErrorState error={applications.error} onRetry={() => void applications.refetch()} />;

  return (
    <FlatList
      data={applications.data}
      keyExtractor={(a) => a.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={applications.isRefetching} onRefresh={() => void applications.refetch()} />}
      ListHeaderComponent={
        approve.error || decline.error ? (
          <AppText color={colors.negative} style={styles.error}>
            {errorMessage(approve.error ?? decline.error)}
          </AppText>
        ) : null
      }
      ListEmptyComponent={
        <EmptyState icon="storefront-outline" title="No vendor applications yet" message="Vendors apply from the event page with “Join as Vendor”." />
      }
      renderItem={({ item }) => (
        <ApplicationCard
          application={item}
          busy={(approve.isPending && approve.variables?.id === item.id) || (decline.isPending && decline.variables === item.id)}
          onOpenProfile={() => navigation.navigate('OtherUserProfile', { publicId: item.vendor.publicId })}
          onApprove={(tableNumber) => approve.mutate({ id: item.id, tableNumber })}
          onDecline={() =>
            Alert.alert('Decline vendor', `${item.vendorInfo?.businessName ?? item.vendor.displayName} will be notified.`, [
              { text: 'Keep', style: 'cancel' },
              { text: 'Decline', style: 'destructive', onPress: () => decline.mutate(item.id) },
            ])
          }
        />
      )}
    />
  );
}

function ApplicationCard({
  application,
  busy,
  onOpenProfile,
  onApprove,
  onDecline,
}: {
  application: EventVendorResponse;
  busy: boolean;
  onOpenProfile: () => void;
  onApprove: (tableNumber: string) => void;
  onDecline: () => void;
}) {
  const [table, setTable] = useState(application.tableNumber ?? '');
  const name = application.vendorInfo?.businessName ?? application.vendor.displayName;
  const canDecide = application.status === 'PENDING' || application.status === 'APPROVED' || application.status === 'DECLINED';

  return (
    <Surface style={styles.card}>
      <View style={styles.header}>
        <Avatar url={application.vendorInfo?.logoUrl ?? application.vendor.avatarUrl} name={name} size={44} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1} onPress={onOpenProfile}>
            {name}
          </AppText>
          <AppText variant="caption" color={colors.textMuted}>
            @{application.vendor.username} · ★ {application.vendor.ratingAverage?.toFixed(1) ?? 'new'} · {application.vendor.completedTradeCount} trades
          </AppText>
        </View>
        <AppText variant="caption" color={STATUS_COLOR[application.status]} style={styles.status}>
          {VENDOR_APPLICATION_LABELS[application.status]}
          {application.tableNumber ? ` · T${application.tableNumber}` : ''}
        </AppText>
      </View>
      {application.message ? <AppText color={colors.textMuted}>“{application.message}”</AppText> : null}
      <AppText variant="caption" color={colors.textSubtle}>
        Applied {formatDateShort(application.createdAt)}
        {application.status === 'APPROVED' ? ` · bringing ${application.inventoryCount} cards` : ''}
      </AppText>
      {canDecide ? (
        <View style={styles.actions}>
          <View style={styles.tableField}>
            <TextField placeholder="Table #" value={table} onChangeText={setTable} maxLength={20} autoCapitalize="characters" />
          </View>
          <Button
            title={application.status === 'APPROVED' ? 'Update table' : 'Approve'}
            compact
            loading={busy}
            disabled={table.trim().length === 0}
            onPress={() => onApprove(table.trim())}
          />
          {application.status !== 'DECLINED' ? <Button title="Decline" variant="ghost" compact onPress={onDecline} /> : null}
        </View>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  error: { marginBottom: spacing.sm },
  card: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  status: { fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tableField: { width: 96 },
});
