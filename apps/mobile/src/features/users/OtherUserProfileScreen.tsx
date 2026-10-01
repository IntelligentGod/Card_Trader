import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { api } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { SectionHeader } from '../../components/Controls';
import { EventCard } from '../../components/EventCard';
import { Avatar, RatingStars, ReviewCard } from '../../components/Profile';
import { Screen } from '../../components/Screen';
import { SkeletonBlock } from '../../components/Skeleton';
import { SocialLinksRow } from '../../components/Social';
import { ErrorState } from '../../components/States';
import { Surface } from '../../components/Surface';
import { mediaUrl } from '../../config';
import type { RootScreenProps } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme';
import { formatDateLong } from '../../utils/format';
import { useStartTrade } from '../trades/useStartTrade';

export function OtherUserProfileScreen({ route, navigation }: RootScreenProps<'OtherUserProfile'>) {
  const { publicId, eventId } = route.params;
  const profile = useQuery({ queryKey: queryKeys.user(publicId), queryFn: () => api.users.publicProfile(publicId) });
  const reviews = useQuery({ queryKey: queryKeys.userReviews(publicId), queryFn: () => api.users.reviews(publicId) });
  const vendorEvents = useQuery({
    queryKey: queryKeys.eventList({ vendor: publicId }),
    queryFn: () => api.events.list({ vendor: publicId }),
    enabled: profile.data?.vendor != null,
  });
  const startTrade = useStartTrade();

  if (profile.isPending) {
    return (
      <Screen>
        <SkeletonBlock height={180} />
      </Screen>
    );
  }
  if (profile.error) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;
  const p = profile.data;
  const vendor = p.vendor;

  return (
    <Screen refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()}>
      <Surface style={styles.header}>
        {vendor ? (
          <View style={styles.vendorBanner}>
            {vendor.logoUrl ? (
              <Image source={{ uri: mediaUrl(vendor.logoUrl) }} style={styles.logo} contentFit="cover" />
            ) : (
              <Ionicons name="storefront" size={18} color={colors.primary} />
            )}
            <AppText variant="bodyStrong" color={colors.primary} numberOfLines={1}>
              {vendor.businessName}
            </AppText>
          </View>
        ) : null}
        <Avatar url={p.avatarUrl} name={p.displayName} size={80} />
        <AppText variant="title">{p.displayName}</AppText>
        <AppText color={colors.textMuted}>
          @{p.username}
          {p.location ? ` · ${p.location}` : ''}
        </AppText>
        <View style={styles.rating}>
          <RatingStars rating={p.stats.ratingAverage} />
          <AppText variant="bodyStrong">{p.stats.ratingAverage?.toFixed(1) ?? 'New'}</AppText>
        </View>
        <View style={styles.stats}>
          <Stat label="Completed trades" value={p.stats.completedTradeCount} />
          <Stat label="Reviews" value={p.stats.ratingCount} />
          <Stat label="Available" value={p.availableCount} />
        </View>
        {p.bio ? (
          <AppText color={colors.textMuted} align="center">
            {p.bio}
          </AppText>
        ) : null}
        <SocialLinksRow links={p.socialLinks} />
        <AppText variant="caption" color={colors.textSubtle}>
          Member since {formatDateLong(p.memberSince)}
        </AppText>
      </Surface>

      {vendor ? (
        <Surface style={styles.gap}>
          <AppText variant="label" color={colors.textMuted}>
            Vendor
          </AppText>
          {vendor.description ? <AppText>{vendor.description}</AppText> : null}
          <SocialLinksRow links={vendor.socialLinks} website={vendor.website} />
        </Surface>
      ) : null}

      <Button
        title={`Browse ${p.availableCount} cards (${p.forTradeCount} for trade · ${p.forSaleCount} for sale)`}
        icon="albums-outline"
        variant="secondary"
        onPress={() => navigation.navigate('OtherUserCollection', { publicId, eventId })}
      />
      <Button
        title="Start a trade"
        icon="swap-horizontal"
        loading={startTrade.isPending}
        onPress={() =>
          startTrade.mutate({ publicId, eventId }, { onSuccess: (trade) => navigation.navigate('TradeBuilder', { tradeId: trade.id }) })
        }
      />
      {startTrade.error ? <AppText color={colors.negative}>{errorMessage(startTrade.error)}</AppText> : null}

      {vendor && vendorEvents.data?.data.length ? (
        <View style={styles.gap}>
          <SectionHeader title="Upcoming shows" />
          {vendorEvents.data.data.map((event) => (
            <EventCard key={event.id} event={event} onPress={() => navigation.navigate('EventDetails', { eventId: event.id })} />
          ))}
        </View>
      ) : null}

      <View>
        <SectionHeader title="Reviews" />
        {reviews.data?.data.length ? (
          reviews.data.data.slice(0, 10).map((review) => <ReviewCard key={review.id} review={review} />)
        ) : (
          <AppText color={colors.textMuted}>No reviews yet.</AppText>
        )}
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <AppText variant="heading">{value}</AppText>
      <AppText variant="caption" color={colors.textMuted}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing.sm },
  vendorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    maxWidth: '100%',
  },
  logo: { width: 22, height: 22, borderRadius: 11 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.xl, marginVertical: spacing.sm },
  stat: { alignItems: 'center' },
  gap: { gap: spacing.sm },
});
