import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, Pressable, View, useWindowDimensions } from 'react-native';
import {
  formatCents,
  formatPercent,
  formatSignedCents,
  TRADE_STATUS_LABELS,
  VALUE_RANGES,
  type CollectionItemResponse,
  type EventSummary,
  type TradeListItem,
  type ValueRange,
} from '@card-trader/shared';
import { api } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import { useRefreshOnFocus } from '../../api/useRefreshOnFocus';
import { AppText } from '../../components/AppText';
import { CardArt } from '../../components/CardArt';
import { Avatar } from '../../components/Profile';
import { Disclaimer, Screen } from '../../components/Screen';
import { SkeletonBlock } from '../../components/Skeleton';
import { EmptyState } from '../../components/States';
import { Surface } from '../../components/Surface';
import type { TabScreenProps } from '../../navigation/types';
import { useSession } from '../../stores/session';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { greeting } from '../../utils/format';
import { useUnreadCount } from '../notifications/hooks';
import { usePortfolioHistory, usePortfolioSummary, useTopCards } from '../portfolio/hooks';
import { useTradeList } from '../trades/hooks';
import { HeroValueCard } from './components/HeroValueCard';
import { ValueChart } from './components/ValueChart';

type IconName = keyof typeof Ionicons.glyphMap;

const RANGE_TITLES: Record<ValueRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '1y': 'Last year',
};

/** Dashboard totals change after trades, edits and price updates made elsewhere. */
const REFRESH_ON_FOCUS = [queryKeys.portfolio, queryKeys.trades, queryKeys.events];

/**
 * Discover: what's happening now — the portfolio at a glance, quick actions,
 * upcoming card shows, value over time, top cards and open trades.
 */
export function DiscoverScreen({ navigation }: TabScreenProps<'Discover'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  useRefreshOnFocus(REFRESH_ON_FOCUS);
  const user = useSession((s) => s.user);
  const unread = useUnreadCount();
  const [range, setRange] = useState<ValueRange>('30d');
  const upcoming = useQuery({
    queryKey: queryKeys.eventListFirstPage({ scope: 'upcoming' }),
    queryFn: () => api.events.list({ scope: 'upcoming' }),
  });
  const summary = usePortfolioSummary();
  const history = usePortfolioHistory(range);
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
  const firstName = user?.displayName?.split(' ')[0] ?? 'Collector';

  return (
    <Screen edges={['top']} refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <AppText color={colors.textMuted}>{greeting()},</AppText>
          <AppText variant="title" numberOfLines={1} style={styles.name}>
            {firstName} 👋
          </AppText>
        </View>
        <HeaderButton icon="scan-outline" label="Scan a QR code" onPress={() => navigation.navigate('QrScanner')} />
        <HeaderButton
          icon="notifications-outline"
          label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          onPress={() => navigation.navigate('Notifications')}
          testID="notifications-bell"
          dot={unreadCount > 0}
        />
        <HeaderButton icon="help-circle-outline" label="Help Center" onPress={() => navigation.navigate('HelpCenter')} testID="help-button" />
      </View>

      <HeroValueCard
        summary={summary.data}
        loading={summary.isPending}
        error={summary.error}
        onRetry={() => void summary.refetch()}
        onViewInventory={() => navigation.navigate('Inventory')}
      />

      <View style={styles.quickRow}>
        <QuickAction icon="scan-outline" tint="#2F6BFF" label="Scan QR" hint="Trade with others" onPress={() => navigation.navigate('QrScanner')} />
        <QuickAction icon="add" tint={colors.primary} solid label="Add card" hint="Grow collection" onPress={() => navigation.navigate('AddCard')} />
        <QuickAction icon="qr-code-outline" tint={colors.positive} label="My QR" hint="Share your profile" onPress={() => navigation.navigate('MyQrCode')} />
        <QuickAction icon="calendar-outline" tint="#F26B3A" label="Shows" hint="Find near you" onPress={() => navigation.navigate('Events')} />
      </View>

      <View>
        <SectionTitle title="Upcoming card shows" onSeeAll={() => navigation.navigate('Events')} />
        {upcoming.isPending ? (
          <SkeletonBlock height={96} />
        ) : shows.length === 0 ? (
          <Surface>
            <AppText color={colors.textMuted}>No upcoming shows yet. Organizers can create one in Events.</AppText>
          </Surface>
        ) : (
          <ShowCarousel shows={shows} onOpen={(eventId) => navigation.navigate('EventDetails', { eventId })} />
        )}
      </View>

      <Surface style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <AppText variant="heading">Collection Value</AppText>
          <RangePicker value={range} onChange={setRange} />
        </View>
        <ChartHeadline points={history.data?.points} loading={history.isPending} />
        {history.isPending ? <SkeletonBlock height={170} /> : history.data ? <ValueChart points={history.data.points} /> : null}
        <Pressable onPress={() => navigation.navigate('CollectionAnalytics')} style={styles.analyticsLink} hitSlop={6} accessibilityRole="button">
          <AppText variant="caption" color={colors.primary} style={styles.bold}>
            Open analytics
          </AppText>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      </Surface>

      <View>
        <SectionTitle title="Most valuable" onSeeAll={top.data && top.data.length > 0 ? () => navigation.navigate('Inventory') : undefined} />
        {top.isPending ? (
          <SkeletonBlock height={88} />
        ) : top.data && top.data.length === 0 ? (
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
            contentContainerStyle={styles.hList}
            renderItem={({ item }) => <TopCardTile item={item} onPress={() => navigation.navigate('CardDetails', { itemId: item.id })} />}
          />
        )}
      </View>

      <View>
        <SectionTitle title="Active trades" onSeeAll={() => navigation.navigate('Trade')} />
        {activeTrades.length === 0 ? (
          <Surface>
            <AppText color={colors.textMuted}>No open trades. Scan a collector’s QR code or search a show to start one.</AppText>
          </Surface>
        ) : (
          <View style={styles.tradeList}>
            {activeTrades.map((trade) => (
              <TradeRow
                key={trade.id}
                trade={trade}
                myName={user?.displayName ?? 'Me'}
                myAvatar={user?.avatarUrl ?? null}
                onPress={() => navigation.navigate(trade.status === 'DRAFT' ? 'TradeBuilder' : 'TradeConfirmation', { tradeId: trade.id })}
              />
            ))}
          </View>
        )}
      </View>

      <Disclaimer />
    </Screen>
  );
}

// ───────────── Header ─────────────

function HeaderButton({ icon, label, onPress, testID, dot }: { icon: IconName; label: string; onPress: () => void; testID?: string; dot?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
      {dot ? <View style={styles.dot} testID="notifications-dot" /> : null}
    </Pressable>
  );
}

function SectionTitle({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="heading">{title}</AppText>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8} style={styles.seeAll} accessibilityRole="button" accessibilityLabel={`See all ${title.toLowerCase()}`}>
          <AppText variant="bodyStrong" color={colors.primary}>
            See all
          </AppText>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ───────────── Quick actions ─────────────

function QuickAction({ icon, tint, solid, label, hint, onPress }: { icon: IconName; tint: string; solid?: boolean; label: string; hint: string; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable style={({ pressed }) => [styles.quick, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.quickIcon, { backgroundColor: solid ? tint : `${tint}1F` }]}>
        <Ionicons name={icon} size={22} color={solid ? colors.onPrimary : tint} />
      </View>
      <AppText variant="bodyStrong" style={styles.quickLabel} numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="caption" color={colors.textMuted} style={styles.quickHint} numberOfLines={1} adjustsFontSizeToFit>
        {hint}
      </AppText>
    </Pressable>
  );
}

// ───────────── Shows ─────────────

function ShowCarousel({ shows, onOpen }: { shows: EventSummary[]; onOpen: (eventId: string) => void }) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const cardWidth = shows.length > 1 ? width - spacing.lg * 2 - 28 : width - spacing.lg * 2;
  return (
    <FlatList
      horizontal
      data={shows}
      keyExtractor={(event) => event.id}
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + spacing.md}
      decelerationRate="fast"
      contentContainerStyle={styles.hList}
      renderItem={({ item }) => <ShowCard event={item} width={cardWidth} onPress={() => onOpen(item.id)} />}
    />
  );
}

function ShowCard({ event, width, onPress }: { event: EventSummary; width: number; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const time = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const sameDay = start.toDateString() === end.toDateString();
  const when = sameDay ? `${time(start)} - ${time(end)}` : `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.showCard, { width }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${when}, ${event.venueName}, ${event.city}`}
    >
      <View style={styles.dateBadge}>
        <AppText variant="caption" color={colors.primary} style={styles.dateMonth}>
          {start.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
        </AppText>
        <AppText variant="title" color={colors.primary} style={styles.dateDay}>
          {start.getDate()}
        </AppText>
        <AppText variant="caption" color={colors.primary}>
          {start.toLocaleDateString('en-US', { weekday: 'short' })}
        </AppText>
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1} style={styles.showTitle}>
          {event.title}
        </AppText>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <AppText variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.flex}>
            {when}
          </AppText>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={colors.textMuted} />
          <AppText variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.flex}>
            {event.venueName} - {event.city}
            {event.region ? `, ${event.region}` : ''}
          </AppText>
        </View>
      </View>
      <View style={styles.showArt}>
        <Ionicons name="storefront" size={26} color={colors.onPrimary} />
        <AppText variant="caption" color={colors.onPrimary} style={styles.bold}>
          {event.approvedVendorCount} {event.approvedVendorCount === 1 ? 'vendor' : 'vendors'}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

// ───────────── Value chart ─────────────

function RangePicker({ value, onChange }: { value: ValueRange; onChange: (range: ValueRange) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.rangeButton} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Range: ${RANGE_TITLES[value]}`}>
        <AppText variant="caption" color={colors.textMuted} style={styles.bold}>
          {RANGE_TITLES[value]}
        </AppText>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
      </Pressable>
      {open ? (
        <View style={styles.rangeMenu}>
          {VALUE_RANGES.map((r) => (
            <Pressable
              key={r}
              onPress={() => {
                onChange(r);
                setOpen(false);
              }}
              style={[styles.rangeOption, r === value && styles.rangeOptionActive]}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: r === value }}
            >
              <AppText variant="caption" color={r === value ? colors.primary : colors.text} style={styles.bold}>
                {RANGE_TITLES[r]}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ChartHeadline({ points, loading }: { points: readonly { valueCents: number }[] | undefined; loading: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (loading || !points || points.length === 0) return <SkeletonBlock width={160} height={34} />;
  const first = points[0]!.valueCents;
  const last = points[points.length - 1]!.valueCents;
  const change = last - first;
  const percent = first > 0 ? (change / first) * 100 : null;
  const tone = change > 0 ? colors.positive : change < 0 ? colors.negative : colors.textMuted;
  return (
    <View>
      <AppText variant="display" style={styles.chartValue} numberOfLines={1} adjustsFontSizeToFit>
        {formatCents(last)}
      </AppText>
      <View style={styles.metaRow}>
        <Ionicons name={change > 0 ? 'trending-up' : change < 0 ? 'trending-down' : 'remove'} size={15} color={tone} />
        <AppText variant="caption" color={tone} style={styles.bold}>
          {formatSignedCents(change)}
          {percent !== null ? ` (${formatPercent(percent)})` : ''}
        </AppText>
      </View>
    </View>
  );
}

// ───────────── Cards & trades ─────────────

function TopCardTile({ item, onPress }: { item: CollectionItemResponse; onPress: () => void }) {
  const styles = useStyles();
  const { categoryColors, colors } = useTheme();
  const palette = categoryColors[item.card.category];
  const value = item.totalValueCents !== null ? formatCents(item.totalValueCents) : 'No price yet';
  return (
    <Pressable
      style={({ pressed }) => [styles.topCard, { backgroundColor: palette.soft, borderColor: `${palette.main}55` }, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.card.name}, ${item.tierLabel}, ${value}`}
    >
      <CardArt imageUrl={item.imageUrl} name={item.card.name} category={item.card.category} cardNumber={item.card.cardNumber} width={52} />
      <View style={styles.topBody}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {item.card.name}
        </AppText>
        <View style={styles.tierPill}>
          <AppText variant="caption" color={colors.white} style={styles.tierText} numberOfLines={1}>
            {item.tierLabel}
          </AppText>
        </View>
        <View style={styles.topPriceRow}>
          <AppText variant="bodyStrong" style={styles.topPrice} numberOfLines={1}>
            {value}
          </AppText>
          <Ionicons name="chevron-forward" size={14} color={colors.textSubtle} />
        </View>
      </View>
    </Pressable>
  );
}

function TradeRow({ trade, myName, myAvatar, onPress }: { trade: TradeListItem; myName: string; myAvatar: string | null; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const other = trade.otherUser;
  const statusText = trade.awaitingMe
    ? trade.isCounterOffer
      ? 'Counteroffer for you'
      : 'Waiting for you'
    : trade.status === 'PROPOSED'
      ? 'Waiting for response'
      : TRADE_STATUS_LABELS[trade.status];
  const pill = trade.awaitingMe ? { bg: colors.primary, fg: colors.onPrimary } : { bg: colors.primarySoft, fg: colors.primary };
  return (
    <Pressable style={({ pressed }) => [styles.tradeRow, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button">
      <View style={styles.tradeAvatars}>
        <Avatar url={myAvatar} name={myName} size={36} />
        <Ionicons name="swap-horizontal" size={16} color={colors.textMuted} />
        <Avatar url={other.avatarUrl} name={other.displayName} size={36} />
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          With {other.vendorName ?? other.displayName}
        </AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {TRADE_STATUS_LABELS[trade.status]} · {trade.itemCount} {trade.itemCount === 1 ? 'card' : 'cards'}
        </AppText>
      </View>
      <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
        <AppText variant="caption" color={pill.fg} style={styles.bold} numberOfLines={1}>
          {statusText}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, shadow }) => ({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  pressed: { opacity: 0.85 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  name: { fontSize: 26, fontWeight: '800' },
  headerButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  dot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.negative,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  quickRow: { flexDirection: 'row', gap: spacing.sm },
  quick: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: 4,
    ...shadow,
  },
  quickIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  quickLabel: { fontSize: 14 },
  quickHint: { fontSize: 11 },
  hList: { gap: spacing.md, paddingBottom: 6, paddingHorizontal: 1 },
  showCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow,
  },
  dateBadge: {
    width: 58,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
  },
  dateMonth: { fontWeight: '800', letterSpacing: 1 },
  dateDay: { fontSize: 26, lineHeight: 30, fontWeight: '800' },
  showTitle: { fontSize: 16, marginBottom: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  showArt: {
    width: 76,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  chartCard: { gap: spacing.xs, zIndex: 2 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 3 },
  chartValue: { fontSize: 32 },
  rangeButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  rangeMenu: {
    position: 'absolute',
    top: 28,
    right: 0,
    width: 140,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 10,
    elevation: 8,
    shadowColor: shadow.shadowColor,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  rangeOption: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rangeOptionActive: { backgroundColor: colors.primarySoft },
  analyticsLink: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 2, marginTop: spacing.xs },
  topCard: {
    width: 176,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  topBody: { flex: 1, gap: 4 },
  tierPill: { alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: 'rgba(14,19,40,0.82)', borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1 },
  tierText: { fontSize: 10, fontWeight: '700' },
  topPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topPrice: { fontSize: 15, fontWeight: '800' },
  tradeList: { gap: spacing.sm },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow,
  },
  tradeAvatars: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusPill: { maxWidth: 130, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 4 },
}));
