import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '../../../api/client';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { Screen } from '../../../components/Screen';
import { useAuthNotice } from '../../../stores/authNotice';
import { useSession } from '../../../stores/session';
import { colors, spacing } from '../../../theme';
import { useResendVerification } from '../hooks';
import { refreshMe } from '../sessionActions';

/**
 * Shown once after creating an account. Verifying isn't required to use the
 * app; a reminder stays on Discover until it's done.
 */
export function VerifyEmailScreen() {
  const user = useSession((s) => s.user);
  const close = () => useAuthNotice.getState().setVerifyEmailIntro(false);
  const resend = useResendVerification();
  const [notYet, setNotYet] = useState(false);

  const check = useMutation({
    mutationFn: refreshMe,
    onSuccess: (me) => setNotYet(!me.emailVerified),
  });

  // Verified in the browser and came back (the foreground refetch updated the user).
  useEffect(() => {
    if (user?.emailVerified) close();
  }, [user?.emailVerified]);

  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Ionicons name="mail-unread" size={32} color={colors.primary} />
        </View>
        <AppText variant="title" align="center">
          Check your inbox
        </AppText>
        <AppText color={colors.textMuted} align="center">
          We sent a verification link to{' '}
          <AppText variant="bodyStrong" testID="verify-email-address">
            {user?.email}
          </AppText>
          . Open it to confirm this email is yours, then come back here.
        </AppText>
        <AppText variant="caption" color={colors.textSubtle} align="center">
          Can’t find it? Check spam or promotions. The link expires after a while — you can always send a new one.
        </AppText>
      </View>

      {notYet ? (
        <AppText color={colors.warning} align="center">
          Not verified yet. Tap the link in the email, then try again.
        </AppText>
      ) : null}
      {check.error ? <AppText color={colors.negative}>{errorMessage(check.error)}</AppText> : null}
      {resend.isSuccess ? (
        <AppText color={colors.positive} align="center">
          Sent. It can take a minute to arrive.
        </AppText>
      ) : null}
      {resend.error ? (
        <AppText color={colors.negative} align="center" testID="verify-email-resend-error">
          {errorMessage(resend.error)}
        </AppText>
      ) : null}

      <Button title="I’ve verified it" icon="checkmark-circle-outline" onPress={() => check.mutate()} loading={check.isPending} />
      <Button title="Resend email" variant="secondary" icon="refresh" onPress={() => resend.mutate()} loading={resend.isPending} />
      <Button title="Continue to the app" variant="ghost" testID="verify-email-continue" onPress={close} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center' },
  header: { gap: spacing.sm, alignItems: 'center', marginBottom: spacing.md },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
});
