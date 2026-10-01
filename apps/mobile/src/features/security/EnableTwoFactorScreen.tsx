import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Share, StyleSheet, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { api } from '../../api/endpoints';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { QRCodeView } from '../../components/QRCodeView';
import { Screen } from '../../components/Screen';
import { SkeletonBlock } from '../../components/Skeleton';
import { ErrorState } from '../../components/States';
import { Surface } from '../../components/Surface';
import type { RootScreenProps } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme';
import { TwoFactorCodeForm } from '../auth/components/TwoFactorCodeForm';
import { refreshMe } from '../auth/sessionActions';
import { groupSecret } from '../auth/twoFactor';

/** Scan (or type) the secret into an authenticator app, confirm one code, then save the recovery codes. */
export function EnableTwoFactorScreen({ navigation }: RootScreenProps<'EnableTwoFactor'>) {
  // A POST: every call makes a new secret, so run it once per visit rather than as a refetching query.
  const setup = useMutation({ mutationFn: api.auth.twoFactorSetup });
  const enable = useMutation({
    mutationFn: (code: string) => api.auth.twoFactorEnable(code),
    onSuccess: ({ recoveryCodes }) => {
      void refreshMe().catch(() => undefined);
      navigation.replace('RecoveryCodes', { codes: recoveryCodes });
    },
  });

  const { mutate: startSetup } = setup;
  useEffect(() => {
    startSetup();
  }, [startSetup]);

  if (setup.error) return <ErrorState error={setup.error} onRetry={() => setup.mutate()} />;
  if (!setup.data) {
    return (
      <Screen>
        <SkeletonBlock height={260} />
        <SkeletonBlock height={120} />
      </Screen>
    );
  }

  const { secret, otpauthUrl } = setup.data;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <AppText color={colors.textMuted}>
          Use an authenticator app such as Google Authenticator, Microsoft Authenticator, 1Password or Authy.
        </AppText>

        <Surface style={styles.group}>
          <AppText variant="heading">1. Add Card Trader to the app</AppText>
          <AppText color={colors.textMuted}>
            Scan this code with the authenticator on another device, or tap “Open authenticator app” if it’s on this phone.
          </AppText>
          <View style={styles.qr} testID="two-factor-qr">
            <QRCodeView value={otpauthUrl} size={200} label="Two-factor setup QR code" />
          </View>
          <Button
            title="Open authenticator app"
            icon="open-outline"
            variant="secondary"
            onPress={() => void Linking.openURL(otpauthUrl).catch(() => undefined)}
          />
          <AppText variant="label" color={colors.textMuted}>
            Or enter this key by hand
          </AppText>
          <View style={styles.secret}>
            <AppText variant="bodyStrong" selectable style={styles.secretText} testID="two-factor-secret">
              {groupSecret(secret)}
            </AppText>
          </View>
          <Button title="Copy / share key" icon="share-outline" variant="ghost" compact onPress={() => void Share.share({ message: secret })} />
        </Surface>

        <Surface style={styles.group}>
          <AppText variant="heading">2. Enter the 6-digit code</AppText>
          <TwoFactorCodeForm
            testID="enable-2fa"
            submitLabel="Turn on"
            allowRecovery={false}
            onSubmit={(proof) => proof.code && enable.mutate(proof.code)}
            loading={enable.isPending}
            error={enable.error ? errorMessage(enable.error) : null}
          />
        </Surface>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: spacing.md },
  qr: { alignItems: 'center', padding: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md },
  secret: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.md },
  secretText: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), letterSpacing: 1, textAlign: 'center' },
});
