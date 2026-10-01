import { useQuery } from '@tanstack/react-query';
import { Share, StyleSheet, View } from 'react-native';
import { buildUserDeepLink } from '@card-trader/shared';
import { api } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Avatar, RatingStars } from '../../components/Profile';
import { QRCodeView } from '../../components/QRCodeView';
import { Screen } from '../../components/Screen';
import { Surface } from '../../components/Surface';
import { useSession } from '../../stores/session';
import { colors, spacing } from '../../theme';

/**
 * Works offline: the QR is drawn on-device from the cached public id, so it can
 * be shown even with no signal on the show floor.
 */
export function MyQrCodeScreen() {
  const user = useSession((s) => s.user);
  const qr = useQuery({ queryKey: queryKeys.qr, queryFn: api.users.qr, enabled: !!user });
  const publicId = qr.data?.publicId ?? user?.publicId;
  if (!user || !publicId) return null;
  const link = qr.data?.deepLink ?? buildUserDeepLink(publicId);

  return (
    <Screen contentStyle={styles.content}>
      <Surface style={styles.card}>
        <Avatar url={user.avatarUrl} name={user.displayName} size={64} />
        <AppText variant="title">{user.displayName}</AppText>
        <View style={styles.rating}>
          <RatingStars rating={user.stats.ratingAverage} />
          <AppText color={colors.textMuted}>
            {user.stats.completedTradeCount} trades
          </AppText>
        </View>
        <View style={styles.qr}>
          <QRCodeView value={link} size={250} />
        </View>
        <AppText variant="caption" color={colors.textMuted} align="center">
          Let another collector scan this to see the cards you’ve marked visible or for trade.
        </AppText>
        <AppText variant="caption" color={colors.textSubtle}>
          Code: {publicId}
        </AppText>
      </Surface>
      <Button title="Share my profile link" icon="share-outline" variant="secondary" onPress={() => void Share.share({ message: link })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'stretch' },
  card: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  rating: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qr: { padding: spacing.md, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
});
