import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import type { TwoFactorProofRequest } from '@card-trader/shared';
import { ApiError, errorMessage } from '../../../api/client';
import { api } from '../../../api/endpoints';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { Screen } from '../../../components/Screen';
import type { RootScreenProps } from '../../../navigation/types';
import { useAuthNotice } from '../../../stores/authNotice';
import { makeStyles, spacing, useTheme } from '../../../theme';
import { TwoFactorCodeForm } from '../components/TwoFactorCodeForm';
import { completeSignIn } from '../sessionActions';

/** Second step of signing in when the account has two-factor authentication. */
export function TwoFactorVerifyScreen({ route, navigation }: RootScreenProps<'TwoFactorVerify'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { challengeToken } = route.params;

  const verify = useMutation({
    mutationFn: (proof: TwoFactorProofRequest) => api.auth.verifyTwoFactor({ challengeToken, ...proof }),
    onSuccess: completeSignIn,
    onError: (error) => {
      // 5 minutes or 5 wrong tries: the password step has to be done again.
      if (error instanceof ApiError && error.code === '2FA_CHALLENGE_EXPIRED') {
        useAuthNotice.getState().setNotice(error.message);
        navigation.popTo('Login');
      }
    },
  });

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.icon}>
            <Ionicons name="shield-checkmark" size={30} color={colors.primary} />
          </View>
          <AppText variant="title">Two-step verification</AppText>
          <AppText color={colors.textMuted}>Open your authenticator app and enter the 6-digit code for Card Trader.</AppText>
        </View>
        <TwoFactorCodeForm
          testID="verify-2fa"
          submitLabel="Verify"
          onSubmit={(proof) => verify.mutate(proof)}
          loading={verify.isPending}
          error={verify.error ? errorMessage(verify.error) : null}
        />
        <Button title="Back to sign in" variant="ghost" onPress={() => navigation.popTo('Login')} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center' },
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
}));
