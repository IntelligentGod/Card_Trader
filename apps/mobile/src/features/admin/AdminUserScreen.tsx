import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import {
  formatCents,
  type AdminAuditEntry,
  type AdminReview,
  type AdminTradeListItem,
  type AdminUserDetail,
  type AdminUserEvent,
  type CollectionItemResponse,
} from '@card-trader/shared';
import { ApiError } from '../../api/client';
import { AppText } from '../../components/AppText';
import { CardRow } from '../../components/CardRow';
import { Segmented } from '../../components/Controls';
import { ListingBadge } from '../../components/ListingBadge';
import { Avatar, RatingStars, ReviewCard } from '../../components/Profile';
import { Screen } from '../../components/Screen';
import { SkeletonBlock, SkeletonList } from '../../components/Skeleton';
import { SocialLinksRow } from '../../components/Social';
import { EmptyState, ErrorState } from '../../components/States';
import { Surface } from '../../components/Surface';
import { mediaUrl } from '../../config';
import type { RootScreenProps } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme';
import { cardSubtitle, formatDateLong, formatRelative } from '../../utils/format';
import { EVENT_STATUS_LABELS, eventRelationText, gradeText } from './adminText';
import { AccountActions, AccountSection } from './AdminUserAccount';
import { AdminTradeRow, AuditEntryCard, RoleBadges, StatTile } from './components';
import { useAdminUser, useAdminUserCollection, useAdminUserHistory, useAdminUserReviews, useAdminUserTrades } from './hooks';

const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404;

type Tab = 'collection' | 'trades' | 'reviews' | 'events' | 'history';

/** One FlatList renders every tab, so the profile header scrolls away with the rows. */
type Row =
  | { kind: 'item'; key: string; item: CollectionItemResponse }
  | { kind: 'trade'; key: string; trade: AdminTradeListItem }
  | { kind: 'heading'; key: string; title: string }
  | { kind: 'review'; key: string; review: AdminReview; written: boolean }
  | { kind: 'event'; key: string; event: AdminUserEvent }
  | { kind: 'audit'; key: string; entry: AdminAuditEntry };

function UserHeader({ user }: { user: AdminUserDetail }) {
  const vendor = user.vendor;
  return (
    <View style={styles.headerBlocks}>
      <Surface style={styles.profile}>
        <Avatar url={user.avatarUrl} name={user.displayName} size={80} />
        <AppText variant="title" align="center">
          {user.displayName}
        </AppText>
        <AppText color={colors.textMuted} align="center">
          @{user.username}
          {user.location ? ` · ${user.location}` : ''}
        </AppText>
        <RoleBadges role={user.role} status={user.status} />
        <View style={styles.rating}>
          <RatingStars rating={user.stats.ratingAverage} />
          <AppText variant="bodyStrong">{user.stats.ratingAverage?.toFixed(1) ?? 'New'}</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            ({user.stats.ratingCount})
          </AppText>
        </View>
        {user.bio ? (
          <AppText color={colors.textMuted} align="center">
            {user.bio}
          </AppText>
        ) : null}
        <SocialLinksRow links={user.socialLinks} />
        <AppText variant="caption" color={colors.textSubtle} align="center">
          Joined {formatDateLong(user.createdAt)} · Last active {user.lastActiveAt ? formatRelative(user.lastActiveAt) : 'never'}
          {'\n'}Public code {user.publicId}
        </AppText>
      </Surface>

      <AccountSection user={user} />
      <AccountActions user={user} />

      {vendor ? (
        <Surface style={styles.group}>
          <View style={styles.vendorTitle}>
            {vendor.logoUrl ? (
              <Image source={{ uri: mediaUrl(vendor.logoUrl) }} style={styles.logo} contentFit="cover" />
            ) : (
              <Ionicons name="storefront" size={18} color={colors.primary} />
            )}
            <AppText variant="bodyStrong" style={styles.flex} numberOfLines={1}>
              {vendor.businessName}
            </AppText>
            <AppText variant="caption" color={vendor.isActive ? colors.positive : colors.textSubtle}>
              {vendor.isActive ? 'Vendor Mode on' : 'Vendor Mode off'}
            </AppText>
          </View>
          {vendor.description ? <AppText color={colors.textMuted}>{vendor.description}</AppText> : null}
          <SocialLinksRow links={vendor.socialLinks} website={vendor.website} />
        </Surface>
      ) : null}

      <Surface style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          Activity
        </AppText>
        <View style={styles.grid}>
          <StatTile label="Collection value" value={formatCents(user.collectionValueCents)} />
          <StatTile label="Items" value={user.counts.collectionItems} hint={`${user.counts.cards} cards`} />
          <StatTile label="Trades" value={user.counts.trades} hint={`${user.counts.activeTrades} active`} />
          <StatTile label="Completed" value={user.stats.completedTradeCount} />
          <StatTile label="Reviews received" value={user.counts.reviewsReceived} />
          <StatTile label="Reviews written" value={user.counts.reviewsWritten} />
        </View>
      </Surface>
    </View>
  );
}

const TABS: { value: Tab; label: string }[] = [
  { value: 'collection', label: 'Cards' },
  { value: 'trades', label: 'Trades' },
  { value: 'reviews', label: 'Reviews' },
  { value: 'events', label: 'Events' },
  { value: 'history', label: 'History' },
];

export function AdminUserScreen({ route, navigation }: RootScreenProps<'AdminUser'>) {
  const { publicId } = route.params;
  const [tab, setTab] = useState<Tab>('collection');
  const detail = useAdminUser(publicId);
  const collection = useAdminUserCollection(publicId, tab === 'collection');
  const trades = useAdminUserTrades(publicId, tab === 'trades');
  const reviews = useAdminUserReviews(publicId, tab === 'reviews');
  const history = useAdminUserHistory(publicId, tab === 'history');

  const displayName = detail.data?.displayName;
  const canEdit = !!detail.data?.permissions.editProfile;
  useEffect(() => {
    navigation.setOptions({
      ...(displayName ? { title: displayName } : {}),
      headerRight: () =>
        canEdit ? (
          <Pressable onPress={() => navigation.navigate('AdminEditUser', { publicId })} hitSlop={8} accessibilityRole="button">
            <AppText variant="bodyStrong" color={colors.primary}>
              Edit
            </AppText>
          </Pressable>
        ) : null,
    });
  }, [canEdit, displayName, navigation, publicId]);

  if (detail.isPending) {
    return (
      <Screen>
        <SkeletonBlock height={260} />
        <SkeletonBlock height={140} />
      </Screen>
    );
  }
  if (detail.error) {
    // Hidden accounts (e.g. the super admin, for normal admins) answer 404 like missing ones.
    if (isNotFound(detail.error)) {
      return <EmptyState icon="person-outline" title="User not found" message="This account doesn’t exist or isn’t visible to you." />;
    }
    return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  }
  const user = detail.data;

  // The query backing the current tab (events come with the detail itself).
  const active =
    tab === 'collection' ? collection : tab === 'trades' ? trades : tab === 'reviews' ? reviews : tab === 'history' ? history : detail;

  let rows: Row[] = [];
  if (tab === 'collection') {
    rows = (collection.data?.pages.flatMap((p) => p.data) ?? []).map((item) => ({ kind: 'item', key: item.id, item }));
  } else if (tab === 'trades') {
    rows = (trades.data?.pages.flatMap((p) => p.data) ?? []).map((trade) => ({ kind: 'trade', key: trade.id, trade }));
  } else if (tab === 'reviews' && reviews.data) {
    const { received, written } = reviews.data;
    if (received.length || written.length) {
      rows = [
        { kind: 'heading', key: 'h-received', title: `Received (${received.length})` },
        ...received.map((review): Row => ({ kind: 'review', key: `r-${review.id}`, review, written: false })),
        { kind: 'heading', key: 'h-written', title: `Written (${written.length})` },
        ...written.map((review): Row => ({ kind: 'review', key: `w-${review.id}`, review, written: true })),
      ];
    }
  } else if (tab === 'events') {
    rows = user.events.map((event) => ({ kind: 'event', key: `${event.id}-${event.relation}`, event }));
  } else if (tab === 'history') {
    rows = (history.data ?? []).map((entry) => ({ kind: 'audit', key: entry.id, entry }));
  }

  const loadMore = () => {
    const paged = tab === 'collection' ? collection : tab === 'trades' ? trades : null;
    if (paged?.hasNextPage && !paged.isFetchingNextPage) void paged.fetchNextPage();
  };
  const fetchingMore = (tab === 'collection' && collection.isFetchingNextPage) || (tab === 'trades' && trades.isFetchingNextPage);

  const refresh = () => {
    void detail.refetch();
    if (active !== detail) void active.refetch();
  };

  const renderRow = ({ item: row }: { item: Row }) => {
    switch (row.kind) {
      case 'item': {
        const item = row.item;
        return (
          <CardRow
            name={item.card.name}
            subtitle={cardSubtitle(item.card)}
            tierLabel={item.tierLabel}
            category={item.card.category}
            imageUrl={item.imageUrl}
            valueCents={item.totalValueCents}
            quantity={item.quantity}
            trailing={<ListingBadge status={item.listingStatus} askingPriceCents={item.askingPriceCents} showPersonal />}
            footer={
              <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
                {gradeText(item)} · Qty {item.quantity}
                {item.estimatedValueCents !== null && item.quantity > 1 ? ` · ${formatCents(item.estimatedValueCents)} each` : ''}
                {item.certNumber ? ` · Cert #${item.certNumber}` : ''}
                {item.lockedInTrade ? ' · In a trade' : ''}
              </AppText>
            }
          />
        );
      }
      case 'trade':
        return <AdminTradeRow trade={row.trade} onPress={() => navigation.navigate('AdminTrade', { tradeId: row.trade.id })} />;
      case 'heading':
        return (
          <AppText variant="label" color={colors.textMuted} style={styles.heading}>
            {row.title}
          </AppText>
        );
      case 'review':
        return (
          <Pressable onPress={() => navigation.navigate('AdminTrade', { tradeId: row.review.tradeId })}>
            <AppText variant="caption" color={colors.textMuted} style={styles.reviewCaption}>
              {row.written ? `About ${row.review.subject.displayName}` : `From ${row.review.reviewer.displayName}`}
            </AppText>
            <ReviewCard review={row.review} />
          </Pressable>
        );
      case 'audit':
        return <AuditEntryCard entry={row.entry} />;
      case 'event': {
        const event = row.event;
        return (
          <Pressable
            style={({ pressed }) => [styles.event, pressed && styles.pressed]}
            onPress={() => navigation.navigate('EventDetails', { eventId: event.id })}
          >
            <View style={styles.flex}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {event.title}
              </AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {formatDateLong(event.startsAt)} · {EVENT_STATUS_LABELS[event.status]}
              </AppText>
              <AppText variant="caption" color={colors.primary}>
                {eventRelationText(event)}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </Pressable>
        );
      }
    }
  };

  const empty: Record<Tab, { icon: 'albums-outline' | 'swap-horizontal' | 'star-outline' | 'calendar-outline' | 'document-text-outline'; title: string }> = {
    collection: { icon: 'albums-outline', title: 'No cards in this collection' },
    trades: { icon: 'swap-horizontal', title: 'No trades yet' },
    reviews: { icon: 'star-outline', title: 'No reviews yet' },
    events: { icon: 'calendar-outline', title: 'No events' },
    history: { icon: 'document-text-outline', title: 'No admin changes yet' },
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <UserHeader user={user} />
            <Segmented options={TABS} value={tab} onChange={setTab} />
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={renderRow}
        onEndReached={loadMore}
        refreshControl={<RefreshControl refreshing={detail.isRefetching || active.isRefetching} onRefresh={refresh} tintColor={colors.primary} />}
        ListFooterComponent={fetchingMore ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null}
        ListEmptyComponent={
          active.isPending ? (
            <SkeletonList rows={3} />
          ) : active.error ? (
            <ErrorState error={active.error} onRetry={() => void active.refetch()} />
          ) : (
            <EmptyState icon={empty[tab].icon} title={empty[tab].title} />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  header: { gap: spacing.lg, marginBottom: spacing.md },
  headerBlocks: { gap: spacing.md },
  profile: { alignItems: 'center', gap: spacing.sm },
  rating: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  group: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  vendorTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: { width: 22, height: 22, borderRadius: 11 },
  flex: { flex: 1 },
  heading: { marginTop: spacing.sm },
  reviewCaption: { marginBottom: spacing.xs },
  event: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md },
  pressed: { opacity: 0.85 },
});
