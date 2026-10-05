import { useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Controls';
import { Screen } from '../../components/Screen';
import { SkeletonBlock } from '../../components/Skeleton';
import { EmptyState, ErrorState } from '../../components/States';
import { Surface } from '../../components/Surface';
import type { RootScreenProps } from '../../navigation/types';
import { spacing, useTheme } from '../../theme';
import { PASSWORD_MAX, REASON_MAX, validateNewPassword } from './adminForm';
import { useAdminResetPassword, useAdminUser } from './hooks';

/**
 * Sets a new password for the user. The password only lives in these fields until
 * the request succeeds; it is cleared at once and never shown again.
 */
export function AdminResetPasswordScreen({ route, navigation }: RootScreenProps<'AdminResetPassword'>) {
  const { colors } = useTheme();
  const { publicId } = route.params;
  const detail = useAdminUser(publicId);
  const reset = useAdminResetPassword(publicId);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [requireChange, setRequireChange] = useState(true);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  if (detail.isPending) {
    return (
      <Screen>
        <SkeletonBlock height={260} />
      </Screen>
    );
  }
  if (detail.error) return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  const user = detail.data;
  if (!user.permissions.resetPassword) {
    return <EmptyState icon="lock-closed-outline" title="Can’t reset this password" message="Your admin role doesn’t allow it for this account." />;
  }

  const errors = validateNewPassword(password, confirm);
  const valid = Object.keys(errors).length === 0 && reason.length <= REASON_MAX;

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    reset.mutate(
      { newPassword: password, requireChange, reason: reason.trim() || null },
      {
        onSuccess: () => {
          setPassword('');
          setConfirm('');
          reset.reset(); // drop the variables (which hold the password) from the mutation state
          Alert.alert('Password reset', `${user.displayName} has been signed out everywhere.`);
          navigation.goBack();
        },
      },
    );
  };

  return (
    <Screen>
      <Surface style={styles.group}>
        <AppText variant="heading">{user.displayName}</AppText>
        <AppText color={colors.textMuted}>
          {user.email}
        </AppText>
        <AppText color={colors.textMuted}>
          Saving signs {user.displayName} out on every device. Share the new password with them through a safe channel; it is not
          shown again.
        </AppText>
      </Surface>

      <TextField
        label="New password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        textContentType="newPassword"
        maxLength={PASSWORD_MAX}
        hint="10–128 characters"
        error={touched || password ? errors.password : null}
        testID="reset-password"
      />
      <TextField
        label="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        textContentType="newPassword"
        maxLength={PASSWORD_MAX}
        error={touched || confirm ? errors.confirm : null}
        testID="reset-confirm"
      />
      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <AppText>Require a new password at next sign-in</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {requireChange ? 'They must choose their own password before using the app.' : 'They can keep using this password.'}
          </AppText>
        </View>
        <Switch value={requireChange} onValueChange={setRequireChange} trackColor={{ true: colors.primary, false: colors.border }} />
      </View>
      <TextField label="Reason (saved in the audit log)" placeholder="Optional" value={reason} onChangeText={setReason} multiline maxLength={REASON_MAX} />
      {reset.error ? <AppText color={colors.negative}>{errorMessage(reset.error)}</AppText> : null}
      <Button title="Reset password" icon="key-outline" loading={reset.isPending} onPress={submit} testID="reset-submit" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  flex: { flex: 1, gap: 2 },
});
