import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import type { TwoFactorChallengeResponse } from '@card-trader/shared';
import { errorMessage } from '../../../api/client';
import { api } from '../../../api/endpoints';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { TextField } from '../../../components/Controls';
import { Screen } from '../../../components/Screen';
import type { RootScreenProps } from '../../../navigation/types';
import { useAuthNotice } from '../../../stores/authNotice';
import { makeStyles, radius, spacing, useTheme } from '../../../theme';
import { SocialSignInButtons } from '../components/SocialSignInButtons';
import { finishLogin } from '../sessionActions';
import { hasErrors, validateLogin, type AuthFormErrors } from '../validation';

export function LoginScreen({ navigation }: RootScreenProps<'Login'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<AuthFormErrors>({});
  /** why the last session ended (blocked, password changed, 2FA expired…) */
  const notice = useAuthNotice((s) => s.notice);
  const setNotice = useAuthNotice((s) => s.setNotice);

  const toChallenge = (challenge: TwoFactorChallengeResponse) =>
    navigation.navigate('TwoFactorVerify', { challengeToken: challenge.challengeToken, expiresIn: challenge.expiresIn });

  const login = useMutation({
    mutationFn: () => api.auth.login({ email: email.trim(), password }),
    onSuccess: (response) => finishLogin(response, toChallenge),
  });

  const submit = () => {
    const found = validateLogin(email, password);
    setErrors(found);
    if (hasErrors(found)) return;
    setNotice(null);
    login.mutate();
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
        <View style={styles.header}>
          <AppText variant="display">Welcome back</AppText>
          <AppText color={colors.textMuted}>Track your collection and trade at the show.</AppText>
        </View>
        {notice ? (
          <View style={styles.notice} testID="login-notice" accessibilityLiveRegion="polite">
            <Ionicons name="information-circle" size={20} color={colors.warning} />
            <AppText style={styles.flex}>{notice}</AppText>
          </View>
        ) : null}
        <TextField
          label="Email"
          testID="login-email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          error={errors.email}
        />
        <TextField
          label="Password"
          testID="login-password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          onSubmitEditing={submit}
          error={errors.password}
        />
        {login.error ? (
          <AppText testID="login-error" color={colors.negative}>
            {errorMessage(login.error)}
          </AppText>
        ) : null}
        <Button title="Sign in" testID="login-submit" onPress={submit} loading={login.isPending} />
        <SocialSignInButtons mode="signIn" onChallenge={toChallenge} />
        <Button title="Create an account" variant="ghost" onPress={() => navigation.navigate('Register')} />
        <Button title="Need help signing in?" variant="ghost" compact onPress={() => navigation.navigate('HelpCenter')} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center' },
  header: { gap: spacing.sm, marginBottom: spacing.lg },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
}));
