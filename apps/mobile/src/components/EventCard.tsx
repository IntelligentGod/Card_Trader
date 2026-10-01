import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { VENDOR_APPLICATION_LABELS, type EventSummary } from '@card-trader/shared';
import { colors, radius, shadow, spacing } from '../theme';
import { eventDateBadge, formatEventDates } from '../utils/format';
import { AppText } from './AppText';

/** One card show in a list: date badge, title, where, and my relationship to it. */
export function EventCard({ event, onPress, compact = false }: { event: EventSummary; onPress: () => void; compact?: boolean }) {
  const badge = eventDateBadge(event.startsAt);
  const tags: { label: string; color: string }[] = [];
  if (event.status === 'DRAFT') tags.push({ label: 'Draft', color: colors.warning });
  if (event.status === 'CANCELLED') tags.push({ label: 'Cancelled', color: colors.negative });
  if (event.isOrganizer) tags.push({ label: 'Organizer', color: colors.primary });
  if (event.myVendorStatus && event.myVendorStatus !== 'WITHDRAWN') {
    tags.push({
      label: `Vendor · ${VENDOR_APPLICATION_LABELS[event.myVendorStatus]}`,
      color: event.myVendorStatus === 'APPROVED' ? colors.positive : colors.textMuted,
    });
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, compact && styles.compact, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${formatEventDates(event.startsAt, event.endsAt)}, ${event.city}`}
    >
      <View style={styles.date}>
        <AppText variant="caption" color={colors.primary} style={styles.month}>
          {badge.month}
        </AppText>
        <AppText variant="title" color={colors.primary}>
          {badge.day}
        </AppText>
      </View>
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {event.title}
        </AppText>
        <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
          {formatEventDates(event.startsAt, event.endsAt)}
        </AppText>
        <View style={styles.meta}>
          <Ionicons name="location-outline" size={13} color={colors.textMuted} />
          <AppText variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.flex}>
            {event.venueName} · {event.city}
            {event.region ? `, ${event.region}` : ''}
          </AppText>
        </View>
        {!compact ? (
          <View style={styles.tags}>
            <AppText variant="caption" color={colors.textSubtle}>
              {event.approvedVendorCount} {event.approvedVendorCount === 1 ? 'vendor' : 'vendors'}
              {event.admission ? ` · ${event.admission}` : ''}
            </AppText>
            {tags.map((tag) => (
              <AppText key={tag.label} variant="caption" color={tag.color} style={styles.tag}>
                {tag.label}
              </AppText>
            ))}
            {event.isSaved ? <Ionicons name="bookmark" size={13} color={colors.primary} /> : null}
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow,
  },
  compact: { width: 290 },
  pressed: { opacity: 0.85 },
  date: {
    width: 52,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  month: { fontWeight: '800', letterSpacing: 1 },
  body: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  flex: { flex: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  tag: { fontWeight: '700' },
});
