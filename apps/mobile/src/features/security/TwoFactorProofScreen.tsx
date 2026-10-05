import { useMutation } from '@tanstack/react-query';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import type { TwoFactorProofRequest } from '@card-trader/shared';
import { errorMessage } from '../../api/client';
import { api } from '../../api/endpoints';
import { AppText } from '../../components/AppText';
import { Screen } from '../../components/Screen';
import type { RootScreenProps } from '../../navigation/types';
import { useTheme } from '../../theme';
import { TwoFactorCodeForm } from '../auth/components/TwoFactorCodeForm';
import { refreshMe } from '../auth/sessionActions';

const COPY = {
  disable: {
    intro: 'Enter a code from your authenticator app (or a recovery code) to turn off two-factor authentication.',
    submit: 'Turn off',
  },
  regenerate: {
    intro: 'Enter a code from your authenticator app (or a recovery code). Your current recovery codes will stop working.',
    submit: 'Get new codes',
  },
} as const;

/** Proof of the second factor before turning 2FA off or replacing the recovery codes. */
export function TwoFactorProofScreen({ route, navigation }: RootScreenProps<'TwoFactorProof'>) {
  const { colors } = useTheme();
  const { purpose } = route.params;

  const disable = useMutation({
    mutationFn: (proof: TwoFactorProofRequest) => api.auth.twoFactorDisable(proof),
    onSuccess: async () => {
      await refreshMe().catch(() => undefined);
      navigation.goBack();
      Alert.alert('Two-factor authentication is off', 'You’ll sign in with just your password or Google/Apple.');
    },
  });
  const regenerate = useMutation({
    mutationFn: (proof: TwoFactorProofRequest) => api.auth.regenerateRecoveryCodes(proof),
    onSuccess: ({ recoveryCodes }) => navigation.replace('RecoveryCodes', { codes: recoveryCodes }),
  });
  const action = purpose === 'disable' ? disable : regenerate;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <AppText color={colors.textMuted}>{COPY[purpose].intro}</AppText>
        <TwoFactorCodeForm
          testID="two-factor-proof"
          submitLabel={COPY[purpose].submit}
          onSubmit={(proof) => action.mutate(proof)}
          loading={action.isPending}
          error={action.error ? errorMessage(action.error) : null}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
