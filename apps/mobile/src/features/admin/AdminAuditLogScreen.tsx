import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ChipRow } from '../../components/Controls';
import { SkeletonList } from '../../components/Skeleton';
import { EmptyState, ErrorState } from '../../components/States';
import type { RootScreenProps } from '../../navigation/types';
import { colors, spacing } from '../../theme';
import { AUDIT_FILTERS, auditQueryFor, type AuditFilter } from './adminText';
import { AuditEntryCard } from './components';
import { useAdminAuditLog } from './hooks';

const CHIPS = AUDIT_FILTERS.filter((f) => f.value !== 'all').map(({ value, label }) => ({ value, label }));

/** SUPER_ADMIN: every admin action, newest first. */
export function AdminAuditLogScreen({ navigation }: RootScreenProps<'AdminAuditLog'>) {
  const [filter, setFilter] = useState<AuditFilter>('all');
  const list = useAdminAuditLog(auditQueryFor(filter));
  const entries = list.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ChipRow options={CHIPS} value={filter === 'all' ? undefined : filter} onChange={(v) => setFilter(v ?? 'all')} allowNone="All" />
      </View>
      {list.isPending ? (
        <SkeletonList rows={4} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => (
            <AuditEntryCard entry={item} onOpenTarget={(publicId) => navigation.navigate('AdminUser', { publicId })} />
          )}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
          }}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.primary} />}
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null}
          ListEmptyComponent={<EmptyState icon="document-text-outline" title="Nothing logged" message={filter === 'all' ? undefined : 'Try another filter.'} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  list: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl, flexGrow: 1 },
});
