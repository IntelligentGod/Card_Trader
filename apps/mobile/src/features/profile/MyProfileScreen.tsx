import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { isAdminRole } from '@card-trader/shared';
import { errorMessage } from '../../api/client';
import { api } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { SectionHeader } from '../../components/Controls';
import { Avatar, RatingStars, ReviewCard } from '../../components/Profile';
import { Screen } from '../../components/Screen';
import { SocialLinksRow } from '../../components/Social';
import { Surface } from '../../components/Surface';
import type { TabScreenProps } from '../../navigation/types';
import { useSession } from '../../stores/session';
import { colors, spacing } from '../../theme';
import { signOut } from '../auth/sessionActions';
import { useMe, useUpdateMe } from './hooks';

export function MyProfileScreen({ navigation }: TabScreenProps<'Profile'>) {
  const me = useMe();
  const user = useSession((s) => s.user);
  const update = useUpdateMe();
  const [uploading, setUploading] = useState(false);
  const reviews = useQuery({
    queryKey: queryKeys.userReviews(user?.publicId ?? ''),
    queryFn: () => api.users.reviews(user!.publicId),
    enabled: !!user,
  });

  if (!user) return null;

  const changeAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setUploading(true);
    try {
      const uploaded = await api.uploads.image('AVATAR', { uri: asset.uri, name: asset.fileName ?? 'avatar.jpg', type: asset.mimeType ?? 'image/jpeg' });
      await update.mutateAsync({ avatarKey: uploaded.key });
    } catch (error) {
      Alert.alert('Could not update photo', errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Screen edges={['top']} refreshing={me.isRefetching} onRefresh={() => void me.refetch()}>
      <Surface style={styles.header}>
        <Pressable onPress={() => void changeAvatar()} disabled={uploading} accessibilityLabel="Change profile photo">
          <Avatar url={user.avatarUrl} name={user.displayName} size={88} />
          <View style={styles.cameraBadge}>
            <Ionicons name={uploading ? 'hourglass-outline' : 'camera'} size={14} color={colors.white} />
          </View>
        </Pressable>
        <AppText variant="title">{user.displayName}</AppText>
        {user.username ? (
          <AppText color={colors.textMuted}>
            @{user.username}
            {user.location ? ` · ${user.location}` : ''}
          </AppText>
        ) : null}
        {user.bio ? (
          <AppText color={colors.textMuted} align="center">
            {user.bio}
          </AppText>
        ) : null}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <View style={styles.ratingRow}>
              <AppText variant="heading">{user.stats.ratingAverage?.toFixed(1) ?? '—'}</AppText>
              <RatingStars rating={user.stats.ratingAverage} size={12} />
            </View>
            <AppText variant="caption" color={colors.textMuted}>
              Rating
            </AppText>
          </View>
          <View style={styles.stat}>
            <AppText variant="heading">{user.stats.completedTradeCount}</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              Completed trades
            </AppText>
          </View>
          <View style={styles.stat}>
            <AppText variant="heading">{user.stats.ratingCount}</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              Reviews
            </AppText>
          </View>
        </View>
        <SocialLinksRow links={user.socialLinks ?? {}} />
      </Surface>

      <Surface style={styles.vendor}>
        <View style={styles.vendorText}>
          <AppText variant="bodyStrong">{user.vendor?.isActive ? user.vendor.businessName : 'Vendor Mode'}</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {user.vendor?.isActive
              ? 'Vendor Mode is on. Join shows as a vendor and pick the cards you bring.'
              : 'Selling at shows? Switch your profile to Vendor Mode — same account, inventory and reviews.'}
          </AppText>
        </View>
        <Button
          title={user.vendor?.isActive ? 'Edit' : user.vendor ? 'Turn on' : 'Set up'}
          icon="storefront-outline"
          variant={user.vendor?.isActive ? 'secondary' : 'primary'}
          compact
          onPress={() => navigation.navigate('VendorProfileEdit')}
        />
      </Surface>

      <View style={styles.actions}>
        <Button title="Edit profile" icon="create-outline" variant="secondary" onPress={() => navigation.navigate('EditProfile')} />
        <Button title="My QR code" icon="qr-code-outline" variant="secondary" onPress={() => navigation.navigate('MyQrCode')} />
        <Button title="Trade history" icon="time-outline" variant="secondary" onPress={() => navigation.navigate('TradeHistory')} />
        <Button title="Settings" icon="settings-outline" variant="secondary" onPress={() => navigation.navigate('Settings')} />
        {isAdminRole(user.role) ? (
          <Button
            title="Admin console"
            icon="shield-checkmark-outline"
            variant="secondary"
            testID="admin-console"
            onPress={() => navigation.navigate('AdminHome')}
          />
        ) : null}
      </View>

      <View>
        <SectionHeader title="Reviews about you" />
        {reviews.data?.data.length ? (
          reviews.data.data.map((review) => <ReviewCard key={review.id} review={review} />)
        ) : (
          <AppText color={colors.textMuted}>Complete a trade to receive your first review.</AppText>
        )}
      </View>

      <Button title="Sign out" variant="danger" icon="log-out-outline" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing.sm },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  stats: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.sm },
  stat: { alignItems: 'center', gap: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { gap: spacing.sm },
  vendor: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  vendorText: { flex: 1, gap: 2 },
});
