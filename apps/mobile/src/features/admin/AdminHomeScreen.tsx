import { useDeferredValue, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { formatCents, TRADE_STATUS_LABELS, TRADE_STATUSES, type AdminOverview, type UserRole, type UserStatus } from '@card-trader/shared';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { ChipRow, SectionHeader, TextField } from '../../components/Controls';
import { SkeletonBlock, SkeletonList } from '../../components/Skeleton';
import { EmptyState, ErrorState } from '../../components/States';
import { Surface } from '../../components/Surface';
import { ScreenBackground } from '../../components/ScreenBackground';
import type { RootScreenProps } from '../../navigation/types';
import { useSession } from '../../stores/session';
import { makeStyles, spacing, useTheme } from '../../theme';
import { USER_ROLE_LABELS, USER_STATUS_LABELS } from './adminText';
import { AdminUserRow, StatTile } from './components';
import { useAdminOverview, useAdminUserList } from './hooks';

const ROLES: { value: UserRole; label: string }[] = (['USER', 'ADMIN'] as const).map((r) => ({ value: r, label: USER_ROLE_LABELS[r] }));
const STATUSES: { value: UserStatus; label: string }[] = (['ACTIVE', 'BLOCKED', 'DISABLED'] as const).map((s) => ({
  value: s,
  label: USER_STATUS_LABELS[s],
}));

function OverviewTiles({ data }: { data: AdminOverview }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.sections}>
      <Surface style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          Users
        </AppText>
        <View style={styles.grid}>
          <StatTile label="Total" value={data.users.total} hint={`${data.users.active} active · ${data.users.blocked} blocked`} />
          <StatTile label="Vendors" value={data.users.vendors} />
          <StatTile label="New in 7 days" value={data.users.newLast7Days} />
          <StatTile label="Admins" value={data.users.admins} />
        </View>
      </Surface>
      <Surface style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          Collections
        </AppText>
        <View style={styles.grid}>
          <StatTile label="Items" value={data.collection.items} hint={`${data.collection.cards} cards`} />
          <StatTile label="Total value" value={formatCents(data.collection.totalValueCents)} />
        </View>
      </Surface>
      <Surface style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          Trades · {data.trades.total}
        </AppText>
        <View style={styles.grid}>
          {TRADE_STATUSES.map((status) => (
            <StatTile key={status} label={TRADE_STATUS_LABELS[status]} value={data.trades.byStatus[status] ?? 0} />
          ))}
        </View>
      </Surface>
      <Surface style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          Events & reviews
        </AppText>
        <View style={styles.grid}>
          <StatTile label="Events" value={data.events.total} hint={`${data.events.published} published · ${data.events.upcoming} upcoming`} />
          <StatTile label="Reviews" value={data.reviews.total} hint={`Avg ${data.reviews.averageRating?.toFixed(1) ?? '—'}`} />
        </View>
      </Surface>
    </View>
  );
}

export function AdminHomeScreen({ navigation }: RootScreenProps<'AdminHome'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const [role, setRole] = useState<UserRole | undefined>();
  const [status, setStatus] = useState<UserStatus | undefined>();
  const overview = useAdminOverview();
  // Super-admin tools (the API enforces SUPER_ADMIN anyway).
  const superAdmin = useSession((s) => s.user?.role === 'SUPER_ADMIN');
  const list = useAdminUserList({ q: q || undefined, role, status });
  const users = list.data?.pages.flatMap((p) => p.data) ?? [];

  const refresh = () => {
    void overview.refetch();
    void list.refetch();
  };

  // The overview and filters scroll with the list; loading/error states render in place of the rows
  // so the search field keeps its focus while results reload.
  const header = (
    <View style={styles.header}>
      {overview.isPending ? (
        <SkeletonBlock height={220} />
      ) : overview.error ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : (
        <OverviewTiles data={overview.data} />
      )}
      <View style={styles.links}>
        <Button title="All trades" icon="swap-horizontal" variant="secondary" onPress={() => navigation.navigate('AdminTrades')} />
        <Button title="Card catalog" icon="albums-outline" variant="secondary" onPress={() => navigation.navigate('AdminCards')} />
        <Button title="Analytics" icon="pie-chart-outline" variant="secondary" onPress={() => navigation.navigate('AdminAnalytics')} />
        {superAdmin ? (
          <>
            <Button title="Admins" icon="shield-outline" variant="secondary" onPress={() => navigation.navigate('AdminAdmins')} testID="admin-admins" />
            <Button title="Audit log" icon="document-text-outline" variant="secondary" onPress={() => navigation.navigate('AdminAuditLog')} testID="admin-audit" />
            <Button title="Announcement" icon="megaphone-outline" variant="secondary" onPress={() => navigation.navigate('AdminBroadcast')} testID="admin-broadcast" />
          </>
        ) : null}
      </View>
      <View>
        <SectionHeader title="Users" />
        <View style={styles.filters}>
          <TextField
            placeholder="Search email, username or name"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          <ChipRow options={ROLES} value={role} onChange={setRole} allowNone="All roles" />
          <ChipRow options={STATUSES} value={status} onChange={setStatus} allowNone="Any status" />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenBackground />
      <FlatList
        data={users}
        keyExtractor={(u) => u.publicId}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <AdminUserRow user={item} onPress={() => navigation.navigate('AdminUser', { publicId: item.publicId })} />
        )}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl refreshing={list.isRefetching || overview.isRefetching} onRefresh={refresh} tintColor={colors.primary} />
        }
        ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null}
        ListEmptyComponent={
          list.isPending ? (
            <SkeletonList rows={4} />
          ) : list.error ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : (
            <EmptyState icon="people-outline" title="No users found" message={q || role || status ? 'Try other filters.' : undefined} />
          )
        }
      />
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  header: { gap: spacing.lg, marginBottom: spacing.sm },
  sections: { gap: spacing.md },
  group: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filters: { gap: spacing.sm },
  links: { gap: spacing.sm },
}));
