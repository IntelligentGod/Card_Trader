import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NotificationResponse, NotificationType } from '@card-trader/shared';
import { AppText } from '../../components/AppText';
import { colors, radius, spacing } from '../../theme';
import { formatRelative } from '../../utils/format';

export const NOTIFICATION_ICONS: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  TRADE_OFFER: 'swap-horizontal',
  TRADE_COUNTER: 'git-compare',
  TRADE_ACCEPTED: 'checkmark-circle',
  TRADE_DECLINED: 'close-circle',
  TRADE_CANCELLED: 'close-circle-outline',
  TRADE_TERMS_CHANGED: 'create',
  TRADE_COMPLETED: 'trophy',
  REVIEW_RECEIVED: 'star',
  VENDOR_APPLICATION: 'storefront',
  VENDOR_APPROVED: 'storefront',
  VENDOR_DECLINED: 'storefront-outline',
  EVENT_UPDATED: 'calendar',
  EVENT_CANCELLED: 'calendar-clear',
  EVENT_REMINDER: 'alarm',
  ANNOUNCEMENT: 'megaphone',
  ACCOUNT_SECURITY: 'shield-checkmark',
};

/** One notification in the recent list and the full history. Unread rows get an accent bar and a filled icon. */
export function NotificationRow({ notification, onPress }: { notification: NotificationResponse; onPress: () => void }) {
  const unread = !notification.isRead;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, unread && styles.unread, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${notification.title}. ${notification.body}`}
      testID={`notification-${notification.id}`}
    >
      <View style={[styles.icon, unread && styles.iconUnread]}>
        <Ionicons name={NOTIFICATION_ICONS[notification.type] ?? 'notifications'} size={20} color={unread ? colors.white : colors.primary} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
            {notification.title}
          </AppText>
          <AppText variant="caption" color={colors.textSubtle}>
            {formatRelative(notification.createdAt)}
          </AppText>
        </View>
        <AppText color={colors.textMuted}>{notification.body}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
  unread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  pressed: { opacity: 0.85 },
  icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  iconUnread: { backgroundColor: colors.primary },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
