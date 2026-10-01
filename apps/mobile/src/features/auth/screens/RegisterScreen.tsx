import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { errorMessage } from '../../../api/client';
import { api } from '../../../api/endpoints';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { TextField } from '../../../components/Controls';
import { Screen } from '../../../components/Screen';
import type { RootScreenProps } from '../../../navigation/types';
import { colors, spacing } from '../../../theme';
import { SocialSignInButtons } from '../components/SocialSignInButtons';
import { completeSignIn } from '../sessionActions';
import { hasErrors, normalizeUsername, validateRegister, type AuthFormErrors } from '../validation';

export function RegisterScreen({ navigation }: RootScreenProps<'Register'>) {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<AuthFormErrors>({});

  const register = useMutation({
    mutationFn: () =>
      api.auth.register({ email: email.trim(), password, username: normalizeUsername(username), displayName: displayName.trim() }),
    onSuccess: (response) => completeSignIn(response),
  });

  const submit = () => {
    const found = validateRegister(email, password, displayName, username);
    setErrors(found);
    if (!hasErrors(found)) register.mutate();
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
        <View style={styles.header}>
          <AppText variant="display">Create account</AppText>
          <AppText color={colors.textMuted}>Other traders see your display name and @username.</AppText>
        </View>
        <TextField label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={40} error={errors.displayName} />
        <TextField
          label="Username"
          placeholder="e.g. tom_cards"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={21}
          hint="Letters, numbers and underscores. Unique."
          error={errors.username}
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          error={errors.email}
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          hint="At least 10 characters. Avoid common passwords."
          error={errors.password}
        />
        {register.error ? <AppText color={colors.negative}>{errorMessage(register.error)}</AppText> : null}
        <Button title="Create account" onPress={submit} loading={register.isPending} />
        <SocialSignInButtons
          mode="signUp"
          onChallenge={(c) => navigation.navigate('TwoFactorVerify', { challengeToken: c.challengeToken, expiresIn: c.expiresIn })}
        />
        <Button title="I already have an account" variant="ghost" onPress={() => navigation.goBack()} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center' },
  header: { gap: spacing.sm, marginBottom: spacing.lg },
});
