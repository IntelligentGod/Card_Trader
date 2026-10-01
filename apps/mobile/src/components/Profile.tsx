import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { mediaUrl } from '../config';
import type { ReviewResponse } from '@card-trader/shared';
import { colors, spacing } from '../theme';
import { formatDateLong } from '../utils/format';
import { AppText } from './AppText';
import { Surface } from './Surface';

export function Avatar({ url, name, size = 48 }: { url: string | null; name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {url ? (
        <Image source={{ uri: mediaUrl(url) }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
      ) : (
        <AppText variant={size > 60 ? 'title' : 'bodyStrong'} color={colors.primary}>
          {initials || '?'}
        </AppText>
      )}
    </View>
  );
}

export function RatingStars({ rating, size = 16 }: { rating: number | null; size?: number }) {
  const value = rating ?? 0;
  return (
    <View style={styles.stars} accessibilityLabel={rating === null ? 'No ratings yet' : `Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={value >= star ? 'star' : value >= star - 0.5 ? 'star-half' : 'star-outline'}
          size={size}
          color={rating === null ? colors.textSubtle : colors.warning}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stars: { flexDirection: 'row', gap: 1 },
});

/** Reviews can only be left after a completed in-app trade. */
export function VerifiedTradeBadge() {
  return (
    <View style={reviewStyles.badge}>
      <Ionicons name="shield-checkmark" size={12} color={colors.positive} />
      <AppText variant="caption" color={colors.positive} style={reviewStyles.badgeText}>
        Verified Trade
      </AppText>
    </View>
  );
}

export function ReviewCard({ review }: { review: ReviewResponse }) {
  return (
    <Surface style={reviewStyles.card}>
      <View style={reviewStyles.header}>
        <AppText variant="bodyStrong" style={reviewStyles.name} numberOfLines={1}>
          {review.reviewer.displayName}
        </AppText>
        <RatingStars rating={review.rating} size={14} />
      </View>
      {review.verifiedTrade ? <VerifiedTradeBadge /> : null}
      {review.comment ? <AppText>{review.comment}</AppText> : null}
      <AppText variant="caption" color={colors.textSubtle}>
        {formatDateLong(review.createdAt)}
      </AppText>
    </Surface>
  );
}

const reviewStyles = StyleSheet.create({
  card: { gap: spacing.xs, marginBottom: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  name: { flexShrink: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.positiveSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontWeight: '700' },
});
