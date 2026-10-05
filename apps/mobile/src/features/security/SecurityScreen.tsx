import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Alert, View } from 'react-native';
import type { AuthProviderType, MeResponse } from '@card-trader/shared';
import { errorMessage } from '../../api/client';
import { api } from '../../api/endpoints';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { Surface } from '../../components/Surface';
import type { RootScreenProps } from '../../navigation/types';
import { useSession } from '../../stores/session';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { socialErrorMessage, useSocialProviders, type SocialProvider } from '../auth/components/SocialSignInButtons';
import { applyMe } from '../auth/hooks';
import { getAppleCredential, getGoogleIdToken } from '../auth/socialSignIn';
import { useMe } from '../profile/hooks';

type LinkedProvider = Exclude<AuthProviderType, 'PASSWORD'>;
const PROVIDER_OF: Record<SocialProvider, LinkedProvider> = { google: 'GOOGLE', apple: 'APPLE' };
const PROVIDER_NAME: Record<SocialProvider, string> = { google: 'Google', apple: 'Apple' };

/** Settings → Security: password, two-factor authentication and sign-in methods. */
export function SecurityScreen({ navigation }: RootScreenProps<'Security'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const me = useMe();
  const user = useSession((s) => s.user);
  const available = useSocialProviders();

  const link = useMutation({
    mutationFn: async (provider: SocialProvider): Promise<MeResponse | null> => {
      if (provider === 'google') {
        const idToken = await getGoogleIdToken();
        return idToken ? api.auth.linkGoogle(idToken) : null;
      }
      const credential = await getAppleCredential();
      return credential ? api.auth.linkApple({ identityToken: credential.identityToken, nonce: credential.nonce }) : null;
    },
    onSuccess: (updated) => {
      if (updated) applyMe(updated);
    },
    onError: (error, provider) => Alert.alert(`Couldn’t link ${PROVIDER_NAME[provider]}`, socialErrorMessage(error, provider)),
  });

  const unlink = useMutation({
    mutationFn: (provider: SocialProvider) => api.auth.unlinkProvider(PROVIDER_OF[provider]),
    onSuccess: applyMe,
    // 409 LAST_SIGN_IN_METHOD: the server explains that one way to sign in must remain.
    onError: (error, provider) => Alert.alert(`Couldn’t remove ${PROVIDER_NAME[provider]}`, errorMessage(error)),
  });

  if (!user) return null;

  const confirmUnlink = (provider: SocialProvider) =>
    Alert.alert(`Remove ${PROVIDER_NAME[provider]} sign-in?`, `You won’t be able to sign in with ${PROVIDER_NAME[provider]} until you link it again.`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => unlink.mutate(provider) },
    ]);

  const providerRow = (provider: SocialProvider) => {
    const linked = user.authProviders.includes(PROVIDER_OF[provider]);
    // Linking needs the provider on this device; removing never does.
    if (!linked && !available[provider]) return null;
    const busy = (link.isPending && link.variables === provider) || (unlink.isPending && unlink.variables === provider);
    return (
      <Row
        key={provider}
        icon={provider === 'google' ? 'logo-google' : 'logo-apple'}
        title={PROVIDER_NAME[provider]}
        subtitle={linked ? 'Linked' : 'Not linked'}
        action={
          <Button
            title={linked ? 'Remove' : 'Link'}
            variant={linked ? 'secondary' : 'primary'}
            compact
            testID={`${provider}-${linked ? 'unlink' : 'link'}`}
            loading={busy}
            onPress={() => (linked ? confirmUnlink(provider) : link.mutate(provider))}
          />
        }
      />
    );
  };

  return (
    <Screen refreshing={me.isRefetching} onRefresh={() => void me.refetch()}>
      <Surface style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          Password
        </AppText>
        <Row
          icon="key-outline"
          title={user.hasPassword ? 'Password' : 'No password yet'}
          subtitle={user.hasPassword ? 'Used to sign in with your email' : 'You sign in with Google or Apple'}
          action={
            <Button
              title={user.hasPassword ? 'Change' : 'Set'}
              variant="secondary"
              compact
              testID="change-password"
              onPress={() => navigation.navigate('ChangePassword')}
            />
          }
        />
      </Surface>

      <Surface style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          Two-factor authentication
        </AppText>
        <Row
          icon="shield-checkmark-outline"
          title="Authenticator app"
          subtitle={user.twoFactorEnabled ? 'A code is asked for every time you sign in' : 'Add a second step when you sign in'}
          action={<StatusPill on={user.twoFactorEnabled} onLabel="On" offLabel="Off" />}
        />
        {user.twoFactorEnabled ? (
          <View style={styles.buttons}>
            <Button
              title="New recovery codes"
              variant="secondary"
              compact
              style={styles.flex}
              onPress={() => navigation.navigate('TwoFactorProof', { purpose: 'regenerate' })}
            />
            <Button
              title="Turn off"
              variant="danger"
              compact
              style={styles.flex}
              testID="disable-2fa"
              onPress={() => navigation.navigate('TwoFactorProof', { purpose: 'disable' })}
            />
          </View>
        ) : (
          <Button title="Turn on two-factor authentication" testID="enable-2fa" onPress={() => navigation.navigate('EnableTwoFactor')} />
        )}
      </Surface>

      <Surface style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          Sign-in methods
        </AppText>
        <Row icon="at-outline" title="Email and password" subtitle={user.hasPassword ? 'Linked' : 'Not set up'} />
        {providerRow('google')}
        {providerRow('apple')}
        <AppText variant="caption" color={colors.textSubtle}>
          Keep at least one way to sign in. Linking only works for the account’s own Google or Apple ID.
        </AppText>
      </Surface>
    </Screen>
  );
}

function Row({ icon, title, subtitle, action }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; action?: ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color={colors.textMuted}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {action}
    </View>
  );
}

function StatusPill({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: on ? colors.positiveSoft : colors.warningSoft }]}>
      <AppText variant="caption" color={on ? colors.positive : colors.warning} style={styles.pillText}>
        {on ? onLabel : offLabel}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  flex: { flex: 1 },
  group: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  pill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 3 },
  pillText: { fontWeight: '700' },
}));
