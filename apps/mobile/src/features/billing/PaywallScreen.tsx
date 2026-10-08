import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { View } from 'react-native';
import { ApiError, errorMessage } from '../../api/client';
import { api } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { Surface } from '../../components/Surface';
import type { RootStackParamList } from '../../navigation/types';
import { useSession } from '../../stores/session';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { applyMe } from '../auth/hooks';
import { signOut } from '../auth/sessionActions';
import { DEFAULT_PRICE_LABEL, getUnlockPackage, identifyPurchaser, purchaseUnlock, purchasesAvailable, restoreUnlock } from './purchases';

const FEATURES: [keyof typeof Ionicons.glyphMap, string][] = [
  ['albums-outline', 'Track your whole collection with live market values'],
  ['swap-horizontal-outline', 'Trade face to face by QR code, with fair values and cash'],
  ['calendar-outline', 'Find cards across every vendor at a show'],
  ['infinite-outline', 'Pay once — yours on Android and iPhone, forever'],
];

/** Blocks the app after sign-up until the one-time unlock is bought (or restored / granted). */
export function PaywallScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const publicId = useSession((s) => s.user?.publicId);

  useEffect(() => {
    if (publicId) void identifyPurchaser(publicId);
  }, [publicId]);

  const status = useQuery({ queryKey: queryKeys.billingStatus, queryFn: api.billing.status });
  const unlockPackage = useQuery({ queryKey: queryKeys.billingPackage, queryFn: getUnlockPackage, enabled: purchasesAvailable, retry: false });

  /** The server checks the store account by itself, so a modified app can't skip paying. */
  const confirm = useMutation({ mutationFn: api.billing.sync, onSuccess: applyMe });
  const buy = useMutation({
    mutationFn: async () => {
      if (!unlockPackage.data) throw new Error('The store has no unlock on offer right now. Please try again later.');
      const result = await purchaseUnlock(unlockPackage.data);
      if (result === 'purchased') await confirm.mutateAsync();
      return result;
    },
  });
  const restore = useMutation({
    mutationFn: async () => {
      const owned = await restoreUnlock();
      if (owned) await confirm.mutateAsync();
      return owned;
    },
  });

  const storeReady = purchasesAvailable && status.data?.storeConfigured !== false && unlockPackage.data != null;
  const price = unlockPackage.data?.product.priceString ?? DEFAULT_PRICE_LABEL;
  const pending = buy.isPending || restore.isPending || confirm.isPending;
  const error = buy.error ?? restore.error ?? confirm.error;
  const notFound = error instanceof ApiError && error.code === 'PAYMENT_REQUIRED';
  const nothingToRestore = restore.isSuccess && restore.data === false;

  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Ionicons name="lock-open-outline" size={30} color={colors.onPrimary} />
        </View>
        <AppText variant="title" align="center">
          Unlock Card Trader
        </AppText>
        <AppText color={colors.textMuted} align="center">
          One payment of <AppText variant="bodyStrong">{price}</AppText>. No subscription, no ads.
        </AppText>
      </View>

      <Surface style={styles.features}>
        {FEATURES.map(([icon, text]) => (
          <View key={text} style={styles.feature}>
            <Ionicons name={icon} size={22} color={colors.primary} />
            <AppText style={styles.featureText}>{text}</AppText>
          </View>
        ))}
      </Surface>

      {!storeReady && !status.isPending ? (
        <AppText color={colors.textMuted} align="center" testID="paywall-unavailable">
          Purchases aren’t available in this version yet. If you already paid, tap “I already paid”.
        </AppText>
      ) : null}
      {error && !notFound ? (
        <AppText color={colors.negative} align="center" testID="paywall-error">
          {errorMessage(error)}
        </AppText>
      ) : null}
      {notFound ? (
        <AppText color={colors.warning} align="center" testID="paywall-not-found">
          {errorMessage(error)}
        </AppText>
      ) : null}
      {nothingToRestore ? (
        <AppText color={colors.textMuted} align="center">
          No earlier purchase was found on this phone’s store account.
        </AppText>
      ) : null}

      <Button title={`Unlock for ${price}`} icon="card-outline" onPress={() => buy.mutate()} loading={buy.isPending} disabled={!storeReady || pending} testID="paywall-buy" />
      <Button title="Restore purchases" variant="secondary" icon="refresh-outline" onPress={() => restore.mutate()} loading={restore.isPending} disabled={!purchasesAvailable || pending} testID="paywall-restore" />
      <Button title="I already paid" variant="ghost" onPress={() => confirm.mutate()} loading={confirm.isPending && !buy.isPending && !restore.isPending} disabled={pending} testID="paywall-check" />

      <AppText variant="caption" color={colors.textSubtle} align="center">
        Bought on another phone? Sign in with the same account and tap “I already paid”. Payment is handled by {'\n'}Google Play or the App Store.
      </AppText>

      <View style={styles.footer}>
        <Button title="Help Center" variant="ghost" icon="help-circle-outline" onPress={() => navigation.navigate('HelpCenter')} />
        <Button title="Sign out" variant="ghost" icon="log-out-outline" onPress={() => void signOut()} testID="paywall-sign-out" />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  content: { gap: spacing.md, paddingTop: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.sm },
  badge: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  features: { gap: spacing.md, borderRadius: radius.lg },
  feature: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  featureText: { flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
}));
