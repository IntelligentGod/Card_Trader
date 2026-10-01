import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { formatCents, TRADE_STATUS_LABELS } from '@card-trader/shared';
import { api } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import { AppText } from '../../components/AppText';
import { CardArt } from '../../components/CardArt';
import { SectionHeader } from '../../components/Controls';
import { EventCard } from '../../components/EventCard';
import { LineChart } from '../../components/LineChart';
import { PriceText } from '../../components/PriceText';
import { Disclaimer, Screen } from '../../components/Screen';
import { SkeletonBlock } from '../../components/Skeleton';
import { EmptyState, ErrorState } from '../../components/States';
import { Surface } from '../../components/Surface';
import { TrendBadge } from '../../components/TrendBadge';
import type { TabScreenProps } from '../../navigation/types';
import { useSession } from '../../stores/session';
import { colors, radius, spacing } from '../../theme';
import { greeting } from '../../utils/format';
import { useUnreadCount } from '../notifications/hooks';
import { usePortfolioHistory, usePortfolioSummary, useTopCards } from '../portfolio/hooks';
import { useTradeList } from '../trades/hooks';

/**
 * Discover: what's happening now — upcoming card shows, the portfolio at a
 * glance, open trades, and the entry points (scan, add, notifications).
 */
export function DiscoverScreen({ navigation }: TabScreenProps<'Discover'>) {
  const user = useSession((s) => s.user);
  const unread = useUnreadCount();
  const upcoming = useQuery({
    queryKey: queryKeys.eventList({ scope: 'upcoming' }),
    queryFn: () => api.events.list({ scope: 'upcoming' }),
  });
  const summary = usePortfolioSummary();
  const history = usePortfolioHistory('30d');
  const top = useTopCards();
  const trades = useTradeList('active');

  const refreshing = summary.isRefetching || history.isRefetching || top.isRefetching;
  const refresh = () => {
    void summary.refetch();
    void history.refetch();
    void top.refetch();
    void trades.refetch();
    void upcoming.refetch();
    void unread.refetch();
  };
  const unreadCount = unread.data?.count ?? 0;
  const shows = upcoming.data?.data.slice(0, 6) ?? [];
  const activeTrades = trades.data?.pages.flatMap((p) => p.data).slice(0, 3) ?? [];

  return (
    <Screen edges={['top']} refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <AppText color={colors.textMuted}>{greeting()},</AppText>
          <AppText variant="title">{user?.displayName ?? 'Collector'}</AppText>
        </View>
        <Pressable
          style={styles.iconButton}
          onPress={() => navigation.navigate('QrScanner')}
          accessibilityRole="button"
          accessibilityLabel="Scan a QR code"
        >
          <Ionicons name="scan" size={22} color={colors.text} />
        </Pressable>
        <Pressable
          style={styles.iconButton}
          onPress={() => navigation.navigate('Notifications')}
          accessibilityRole="button"
          accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          testID="notifications-bell"
        >
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <AppText variant="caption" color={colors.white} style={styles.badgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      </View>

      <Surface style={styles.valueCard}>
        <AppText variant="label" color="rgba(255,255,255,0.75)">
          Collection value
        </AppText>
        {summary.isPending ? (
          <SkeletonBlock width={180} height={40} />
        ) : summary.error ? (
          <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
        ) : (
          <>
            <AppText testID="home-total" variant="display" color={colors.white}>
              {formatCents(summary.data.totalValueCents)}
            </AppText>
            <View style={styles.badges}>
              <TrendBadge amountCents={summary.data.change['1d'].amountCents} percent={summary.data.change['1d'].percent} suffix="today" size="sm" />
              <TrendBadge amountCents={summary.data.change['30d'].amountCents} percent={summary.data.change['30d'].percent} suffix="30d" size="sm" />
            </View>
            <AppText variant="caption" color="rgba(255,255,255,0.75)">
              {summary.data.cardCount} cards
              {summary.data.unpricedCount > 0 ? ` · ${summary.data.unpricedCount} awaiting a price` : ''}
            </AppText>
          </>
        )}
        <Pressable style={styles.viewCollection} onPress={() => navigation.navigate('Inventory')}>
          <AppText variant="bodyStrong" color={colors.primary}>
            View inventory
          </AppText>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </Pressable>
      </Surface>

      <View style={styles.quickRow}>
        <QuickAction icon="scan" label="Scan QR" onPress={() => navigation.navigate('QrScanner')} />
        <QuickAction icon="add-circle" label="Add card" onPress={() => navigation.navigate('AddCard')} />
        <QuickAction icon="qr-code" label="My QR" onPress={() => navigation.navigate('MyQrCode')} />
        <QuickAction icon="calendar" label="Shows" onPress={() => navigation.navigate('Events')} />
      </View>

      <View>
        <SectionHeader title="Upcoming card shows" action="See all" onAction={() => navigation.navigate('Events')} />
        {upcoming.isPending ? (
          <SkeletonBlock height={84} />
        ) : shows.length === 0 ? (
          <AppText color={colors.textMuted}>No upcoming shows yet. Organizers can create one in Events.</AppText>
        ) : (
          <FlatList
            horizontal
            data={shows}
            keyExtractor={(event) => event.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.showList}
            renderItem={({ item }) => (
              <EventCard compact event={item} onPress={() => navigation.navigate('EventDetails', { eventId: item.id })} />
            )}
          />
        )}
      </View>

      <Surface>
        <SectionHeader title="Last 30 days" action="Analytics" onAction={() => navigation.navigate('CollectionAnalytics')} />
        {history.isPending ? <SkeletonBlock height={160} /> : history.data ? <LineChart points={history.data.points} height={160} /> : null}
      </Surface>

      <View>
        <SectionHeader title="Most valuable" />
        {top.data && top.data.length === 0 ? (
          <Surface>
            <EmptyState
              icon="albums-outline"
              title="No cards yet"
              message="Add your first card to start tracking its value."
              actionTitle="Add a card"
              onAction={() => navigation.navigate('AddCard')}
            />
          </Surface>
        ) : (
          <FlatList
            horizontal
            data={top.data ?? []}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.topList}
            renderItem={({ item }) => (
              <Pressable style={styles.topCard} onPress={() => navigation.navigate('CardDetails', { itemId: item.id })}>
                <CardArt imageUrl={item.imageUrl} name={item.card.name} category={item.card.category} cardNumber={item.card.cardNumber} width={104} badge={item.tierLabel} />
                <AppText variant="caption" numberOfLines={1} style={styles.topName}>
                  {item.card.name}
                </AppText>
                <PriceText cents={item.totalValueCents} />
              </Pressable>
            )}
          />
        )}
      </View>

      <View>
        <SectionHeader title="Active trades" action="See all" onAction={() => navigation.navigate('Trade')} />
        {activeTrades.length === 0 ? (
          <AppText color={colors.textMuted}>No open trades. Scan a collector’s QR code or search a show to start one.</AppText>
        ) : (
          <View style={styles.tradeList}>
            {activeTrades.map((trade) => (
              <Pressable
                key={trade.id}
                style={styles.tradeRow}
                onPress={() =>
                  navigation.navigate(trade.status === 'DRAFT' ? 'TradeBuilder' : 'TradeConfirmation', { tradeId: trade.id })
                }
              >
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">With {trade.otherUser.vendorName ?? trade.otherUser.displayName}</AppText>
                  <AppText variant="caption" color={trade.awaitingMe ? colors.primary : colors.textMuted}>
                    {trade.awaitingMe ? (trade.isCounterOffer ? 'Counteroffer for you' : 'Waiting for you') : TRADE_STATUS_LABELS[trade.status]} ·{' '}
                    {trade.itemCount} cards
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Disclaimer />
    </Screen>
  );
}

function QuickAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.quick, pressed && { opacity: 0.8 }]} onPress={onPress} accessibilityRole="button">
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <AppText variant="caption" style={styles.quickLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.negative,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '800', lineHeight: 12 },
  showList: { gap: spacing.md, paddingBottom: 4, paddingHorizontal: 2 },
  valueCard: { backgroundColor: colors.primary, gap: spacing.sm },
  badges: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  viewCollection: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  quickRow: { flexDirection: 'row', gap: spacing.sm },
  quick: { flex: 1, alignItems: 'center', gap: spacing.xs, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.md },
  quickIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontWeight: '600' },
  topList: { gap: spacing.md },
  topCard: { width: 112, gap: 4 },
  topName: { marginTop: 4 },
  tradeList: { gap: spacing.sm },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
