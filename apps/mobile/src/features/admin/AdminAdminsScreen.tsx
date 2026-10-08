import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { SkeletonList } from '../../components/Skeleton';
import { EmptyState, ErrorState } from '../../components/States';
import { ScreenBackground } from '../../components/ScreenBackground';
import type { RootScreenProps } from '../../navigation/types';
import { makeStyles, spacing, useTheme } from '../../theme';
import { AdminUserRow } from './components';
import { useAdminUserList } from './hooks';

/** SUPER_ADMIN: every admin account, plus creating new ones. */
export function AdminAdminsScreen({ navigation }: RootScreenProps<'AdminAdmins'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const list = useAdminUserList({ role: 'ADMIN' });
  const admins = list.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <View style={styles.container}>
      <ScreenBackground />
      <View style={styles.header}>
        <AppText color={colors.textMuted}>
          Admins manage regular users. Open an admin to change their role, reset their password or block them.
        </AppText>
        <Button title="Add admin" icon="person-add-outline" onPress={() => navigation.navigate('AdminCreateAdmin')} testID="add-admin" />
      </View>
      {list.isPending ? (
        <SkeletonList rows={3} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <FlatList
          data={admins}
          keyExtractor={(u) => u.publicId}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => <AdminUserRow user={item} onPress={() => navigation.navigate('AdminUser', { publicId: item.publicId })} />}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
          }}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.primary} />}
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null}
          ListEmptyComponent={<EmptyState icon="shield-outline" title="No admins yet" message="Add an admin to help manage accounts." />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md },
  list: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl, flexGrow: 1 },
}));
