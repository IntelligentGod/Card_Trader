import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { TradeListItem } from '@card-trader/shared';
import { queryKeys } from '../../../api/queryKeys';
import { useRefreshOnFocus } from '../../../api/useRefreshOnFocus';
import { AppText } from '../../../components/AppText';
import { SkeletonList } from '../../../components/Skeleton';
import { EmptyState, ErrorState } from '../../../components/States';
import type { RootStackParamList, TabScreenProps } from '../../../navigation/types';
import { makeStyles, radius, spacing, useTheme } from '../../../theme';
import { TradeListRow } from '../components/TradeListRow';
import { ScreenBackground } from '../../../components/ScreenBackground';
import { useTradeList } from '../hooks';

function TradeList({ scope }: { scope: 'active' | 'history' }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const list = useTradeList(scope);
  const trades = list.data?.pages.flatMap((p) => p.data) ?? [];

  const open = (trade: TradeListItem) =>
    navigation.navigate(trade.status === 'DRAFT' ? 'TradeBuilder' : 'TradeConfirmation', { tradeId: trade.id });

  if (list.isPending) return <SkeletonList rows={4} />;
  if (list.error) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;

  return (
    <FlatList
      data={trades}
      keyExtractor={(t) => t.id}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      renderItem={({ item }) => <TradeListRow trade={item} onPress={() => open(item)} />}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
      }}
      refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.primary} />}
      ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null}
      ListEmptyComponent={
        scope === 'active' ? (
          <EmptyState
            icon="swap-horizontal"
            title="No active trades"
            message="Scan another collector’s QR code, or search a card show, to find cards and start a trade."
            actionTitle="Scan QR"
            onAction={() => navigation.navigate('QrScanner')}
          />
        ) : (
          <EmptyState icon="time-outline" title="No past trades" message="Completed, cancelled and declined trades show up here." />
        )
      }
    />
  );
}

const REFRESH_ON_FOCUS = [queryKeys.trades];

export function ActiveTradesScreen({ navigation }: TabScreenProps<'Trade'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  useRefreshOnFocus(REFRESH_ON_FOCUS);
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScreenBackground />
      <View style={styles.header}>
        <AppText variant="title">Trade</AppText>
        <Pressable onPress={() => navigation.navigate('TradeHistory')} hitSlop={8}>
          <AppText variant="bodyStrong" color={colors.primary}>
            History
          </AppText>
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={() => navigation.navigate('QrScanner')} accessibilityRole="button">
          <Ionicons name="scan" size={20} color={colors.onPrimary} />
          <AppText variant="bodyStrong" color={colors.onPrimary}>
            Scan QR to trade
          </AppText>
        </Pressable>
        <Pressable
          style={[styles.action, styles.actionSecondary]}
          onPress={() => navigation.navigate('Main', { screen: 'Events' })}
          accessibilityRole="button"
        >
          <Ionicons name="search" size={20} color={colors.primary} />
          <AppText variant="bodyStrong" color={colors.primary}>
            Search a show
          </AppText>
        </Pressable>
      </View>
      <TradeList scope="active" />
    </SafeAreaView>
  );
}

export function TradeHistoryScreen() {
  const styles = useStyles();
  return (
    <View style={styles.safe}>
      <ScreenBackground />
      <TradeList scope="history" />
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, paddingBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  actionSecondary: { backgroundColor: colors.primarySoft },
  list: { padding: spacing.lg, flexGrow: 1 },
}));
