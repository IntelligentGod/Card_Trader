import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LoginResponse, TwoFactorChallengeResponse } from '@card-trader/shared';
import { ApiError, errorMessage } from '../../../api/client';
import { api } from '../../../api/endpoints';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { makeStyles, radius, spacing, useTheme } from '../../../theme';
import { finishLogin } from '../sessionActions';
import {
  getAppleCredential,
  getGoogleIdToken,
  isAppleSignInAvailable,
  isGoogleSignInAvailable,
  SocialSignInError,
} from '../socialSignIn';

export type SocialProvider = 'google' | 'apple';

export function socialErrorMessage(error: unknown, provider: SocialProvider): string {
  if (error instanceof ApiError) return errorMessage(error);
  if (error instanceof SocialSignInError) return error.message;
  return `Couldn’t continue with ${provider === 'google' ? 'Google' : 'Apple'}. Please try again.`;
}

/** Whether each provider can be offered on this device (Apple is checked asynchronously). */
export function useSocialProviders(): Record<SocialProvider, boolean> {
  const [googleReady] = useState(isGoogleSignInAvailable);
  const [appleReady, setAppleReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void isAppleSignInAvailable().then((available) => {
      // Only a change re-renders (avoids a pointless update after unmount-prone async checks).
      if (alive && available) setAppleReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return { google: googleReady, apple: appleReady };
}

interface Props {
  /** wording only; the server creates the account on first use either way */
  mode: 'signIn' | 'signUp';
  onChallenge: (challenge: TwoFactorChallengeResponse) => void;
}

/** "Continue with Google" / Sign in with Apple, shown only for providers that work here. Renders nothing otherwise. */
export function SocialSignInButtons({ mode, onChallenge }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const available = useSocialProviders();
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!available.google && !available.apple) return null;

  const run = async (provider: SocialProvider, start: () => Promise<LoginResponse | null>) => {
    if (busy) return;
    setError(null);
    setBusy(provider);
    try {
      const response = await start();
      // null = cancelled in the provider's sheet: nothing to say.
      if (response) await finishLogin(response, onChallenge);
    } catch (e) {
      setError(socialErrorMessage(e, provider));
    } finally {
      setBusy(null);
    }
  };

  const google = () =>
    run('google', async () => {
      const idToken = await getGoogleIdToken();
      return idToken ? api.auth.google(idToken) : null;
    });
  const apple = () =>
    run('apple', async () => {
      const credential = await getAppleCredential();
      return credential ? api.auth.apple(credential) : null;
    });

  return (
    <View style={styles.container} testID="social-sign-in">
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <AppText variant="caption" color={colors.textSubtle}>
          or
        </AppText>
        <View style={styles.divider} />
      </View>
      {available.apple ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={
            mode === 'signUp'
              ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
              : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
          }
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={radius.md}
          style={styles.apple}
          onPress={() => void apple()}
        />
      ) : null}
      {available.google ? (
        <Button
          title={mode === 'signUp' ? 'Sign up with Google' : 'Continue with Google'}
          icon="logo-google"
          variant="secondary"
          testID="google-sign-in"
          loading={busy === 'google'}
          disabled={busy === 'apple'}
          onPress={() => void google()}
        />
      ) : null}
      {error ? (
        <AppText testID="social-error" color={colors.negative}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: { gap: spacing.md },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  apple: { height: 50, width: '100%' },
}));
