import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { errorMessage } from '../../../api/client';
import { api } from '../../../api/endpoints';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { TextField } from '../../../components/Controls';
import { Screen } from '../../../components/Screen';
import type { RootScreenProps } from '../../../navigation/types';
import { useSession } from '../../../stores/session';
import { makeStyles, radius, spacing, useTheme } from '../../../theme';
import { completeSignIn, signOut } from '../sessionActions';

interface PasswordErrors {
  current?: string;
  next?: string;
  confirm?: string;
}

export function validatePasswordChange(current: string, next: string, confirm: string, needsCurrent: boolean): PasswordErrors {
  const errors: PasswordErrors = {};
  if (needsCurrent && !current) errors.current = 'Enter your current password';
  if (next.length < 10) errors.next = 'Use at least 10 characters';
  else if (next.length > 128) errors.next = 'Use at most 128 characters';
  if (confirm !== next) errors.confirm = 'The passwords don’t match';
  return errors;
}

/**
 * Change or set the password. In forced mode (an admin reset it) this is the
 * only screen the app shows until a new password is chosen.
 */
export function ChangePasswordScreen({ navigation }: RootScreenProps<'ChangePassword'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const user = useSession((s) => s.user);
  const forced = !!user?.mustChangePassword;
  const setting = !forced && user?.hasPassword === false;
  const needsCurrent = !forced && !setting;

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<PasswordErrors>({});

  const change = useMutation({
    mutationFn: () => api.auth.changePassword({ currentPassword: needsCurrent ? current : undefined, newPassword: next }),
    onSuccess: async (response) => {
      // New tokens: every other session (and the old refresh token) was revoked.
      await completeSignIn(response);
      if (forced) return; // the navigator now shows the app
      Alert.alert(setting ? 'Password set' : 'Password changed', 'Other devices signed in to your account were signed out.');
      navigation.goBack();
    },
  });

  const submit = () => {
    const found = validatePasswordChange(current, next, confirm, needsCurrent);
    setErrors(found);
    if (Object.keys(found).length === 0) change.mutate();
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={forced ? ['bottom'] : []}>
        {forced ? (
          <View style={styles.notice} testID="forced-password-notice">
            <Ionicons name="key" size={20} color={colors.warning} />
            <AppText style={styles.flex}>
              An admin reset your password. Choose a new one to keep using Card Trader — it replaces the temporary password you
              were given.
            </AppText>
          </View>
        ) : setting ? (
          <AppText color={colors.textMuted}>
            You sign in with Google or Apple. Setting a password lets you also sign in with your email address.
          </AppText>
        ) : (
          <AppText color={colors.textMuted}>Changing your password signs you out on your other devices.</AppText>
        )}

        {needsCurrent ? (
          <TextField
            label="Current password"
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            error={errors.current}
          />
        ) : null}
        <TextField
          label="New password"
          testID="new-password"
          value={next}
          onChangeText={setNext}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          hint="10–128 characters. Avoid common passwords and ones you used before."
          error={errors.next}
        />
        <TextField
          label="Confirm new password"
          testID="confirm-password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={submit}
          error={errors.confirm}
        />
        {change.error ? (
          <AppText testID="change-password-error" color={colors.negative}>
            {errorMessage(change.error)}
          </AppText>
        ) : null}
        <Button title={setting ? 'Set password' : 'Change password'} testID="change-password-submit" onPress={submit} loading={change.isPending} />
        {forced ? <Button title="Sign out" variant="ghost" icon="log-out-outline" onPress={() => void signOut()} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  flex: { flex: 1 },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
}));
