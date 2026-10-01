import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../api/endpoints';
import { AppText } from '../../components/AppText';
import { navigationRef } from '../../navigation/deepLinks';
import { useSession } from '../../stores/session';
import { colors, radius, shadow, spacing } from '../../theme';
import { advanceBanner, BANNER_DURATION_MS, EMPTY_BANNER_QUEUE, enqueueBanner } from './bannerQueue';
import { notificationTarget, syncAfterRead } from './hooks';
import { NOTIFICATION_ICONS } from './NotificationRow';
import { subscribeNotifications } from './notificationEvents';

const HIDDEN_Y = -220;

/**
 * Message-style banner for notifications that arrive while the app is open.
 * Mounted once at the root; it never blocks touches outside the banner itself.
 * Tap opens (and marks read), swipe up or ✕ dismisses, otherwise it goes away
 * after a few seconds and the next queued one slides in.
 */
export function NotificationBanner() {
  const status = useSession((s) => s.status);
  const forcedPasswordChange = useSession((s) => !!s.user?.mustChangePassword);
  const enabled = status === 'signedIn' && !forcedPasswordChange;
  const [queue, setQueue] = useState(EMPTY_BANNER_QUEUE);
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const translateY = useRef(new Animated.Value(HIDDEN_Y)).current;
  /** id of the banner currently animating out, so a timeout and a tap don't both advance the queue */
  const hiding = useRef<string | null>(null);
  const current = queue.current;
  const currentId = useRef<string | null>(null);
  currentId.current = current?.id ?? null;

  useEffect(() => {
    if (!enabled) {
      setQueue(EMPTY_BANNER_QUEUE);
      return;
    }
    // In the background the phone notification (phoneAlerts) takes over instead.
    return subscribeNotifications((notification) => {
      if (AppState.currentState === 'active') setQueue((q) => enqueueBanner(q, notification));
    });
  }, [enabled]);

  const dismiss = useCallback(
    (id: string) => {
      if (hiding.current === id) return;
      hiding.current = id;
      Animated.timing(translateY, { toValue: HIDDEN_Y, duration: 180, useNativeDriver: true }).start(() => {
        setQueue((q) => (q.current?.id === id ? advanceBanner(q) : q));
      });
    },
    [translateY],
  );

  useEffect(() => {
    if (!current) return;
    hiding.current = null;
    translateY.setValue(HIDDEN_Y);
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    AccessibilityInfo.announceForAccessibility(`New notification: ${current.title}. ${current.body}`);
    const timer = setTimeout(() => dismiss(current.id), BANNER_DURATION_MS);
    return () => clearTimeout(timer);
  }, [current, dismiss, translateY]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy < -6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => translateY.setValue(Math.min(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if ((g.dy < -30 || g.vy < -0.5) && currentId.current) dismiss(currentId.current);
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  if (!current) return null;

  const open = () => {
    if (!current.isRead) {
      void api.notifications
        .markOneRead(current.id)
        .then((unread) => syncAfterRead(client, current.id, unread))
        .catch(() => undefined);
    }
    if (navigationRef.isReady()) {
      const target = notificationTarget(current.type, current.data);
      navigationRef.navigate(...(target ?? (['Notifications', undefined] as const)));
    }
    dismiss(current.id);
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        {...pan.panHandlers}
        accessibilityLiveRegion="polite"
        testID="notification-banner"
        style={[styles.banner, { top: insets.top + spacing.sm, transform: [{ translateY }] }]}
      >
        <Pressable
          style={styles.content}
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={`${current.title}. ${current.body}`}
          accessibilityHint="Opens the notification"
        >
          <View style={styles.icon}>
            <Ionicons name={NOTIFICATION_ICONS[current.type] ?? 'notifications'} size={18} color={colors.white} />
          </View>
          <View style={styles.text}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {current.title}
            </AppText>
            <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
              {current.body}
            </AppText>
          </View>
          <AppText variant="bodyStrong" color={colors.primary}>
            View
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => dismiss(current.id)}
          hitSlop={10}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
        >
          <Ionicons name="close" size={18} color={colors.textSubtle} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingLeft: spacing.md,
    ...shadow,
    shadowOpacity: 0.16,
    elevation: 8,
  },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  icon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 1 },
  close: { padding: spacing.md },
});
