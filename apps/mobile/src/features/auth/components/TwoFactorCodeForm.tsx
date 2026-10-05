import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { TwoFactorProofRequest } from '@card-trader/shared';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { TextField } from '../../../components/Controls';
import { spacing, useTheme } from '../../../theme';
import { isCompleteOtp, isCompleteRecoveryCode, normalizeOtp, normalizeRecoveryCode, twoFactorProof } from '../twoFactor';

interface Props {
  submitLabel: string;
  onSubmit: (proof: TwoFactorProofRequest) => void;
  loading?: boolean;
  error?: string | null;
  /** offer "Use a recovery code" (not while turning 2FA on) */
  allowRecovery?: boolean;
  testID?: string;
}

/** 6-digit authenticator code, or a recovery code. Submits by itself once 6 digits are in. */
export function TwoFactorCodeForm({ submitLabel, onSubmit, loading, error, allowRecovery = true, testID = 'two-factor' }: Props) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<'code' | 'recovery'>('code');
  const [value, setValue] = useState('');
  const complete = mode === 'code' ? isCompleteOtp(value) : isCompleteRecoveryCode(value);

  const submit = (text = value) => {
    if (!loading) onSubmit(twoFactorProof(mode, text));
  };

  const change = (text: string) => {
    const next = mode === 'code' ? normalizeOtp(text) : normalizeRecoveryCode(text);
    setValue(next);
    if (mode === 'code' && isCompleteOtp(next) && next !== value) submit(next);
  };

  const toggle = () => {
    setMode(mode === 'code' ? 'recovery' : 'code');
    setValue('');
  };

  return (
    <View style={styles.container}>
      {mode === 'code' ? (
        <TextField
          key="code"
          testID={`${testID}-code`}
          label="6-digit code"
          value={value}
          onChangeText={change}
          keyboardType="number-pad"
          inputMode="numeric"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={7}
          autoFocus
          placeholder="123456"
          style={styles.code}
          accessibilityLabel="Six-digit code from your authenticator app"
        />
      ) : (
        <TextField
          key="recovery"
          testID={`${testID}-recovery`}
          label="Recovery code"
          value={value}
          onChangeText={change}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          autoFocus
          maxLength={14}
          placeholder="xxxx-xxxx-xxxx"
          style={styles.code}
          hint="Each recovery code works once."
        />
      )}
      {error ? (
        <AppText testID={`${testID}-error`} color={colors.negative}>
          {error}
        </AppText>
      ) : null}
      <Button title={submitLabel} testID={`${testID}-submit`} onPress={() => submit()} loading={loading} disabled={!complete} />
      {allowRecovery ? (
        <Pressable onPress={toggle} hitSlop={8} accessibilityRole="button" style={styles.toggle}>
          <AppText variant="bodyStrong" color={colors.primary} align="center">
            {mode === 'code' ? 'Use a recovery code' : 'Use the code from my authenticator app'}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  code: { fontSize: 22, letterSpacing: 4, textAlign: 'center', fontVariant: ['tabular-nums'] },
  toggle: { paddingVertical: spacing.sm },
});
