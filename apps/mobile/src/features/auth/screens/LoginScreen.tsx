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
import { completeSignIn } from '../sessionActions';
import { hasErrors, validateLogin, type AuthFormErrors } from '../validation';

export function LoginScreen({ navigation }: RootScreenProps<'Login'>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<AuthFormErrors>({});

  const login = useMutation({
    mutationFn: () => api.auth.login({ email: email.trim(), password }),
    onSuccess: completeSignIn,
  });

  const submit = () => {
    const found = validateLogin(email, password);
    setErrors(found);
    if (!hasErrors(found)) login.mutate();
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
        <View style={styles.header}>
          <AppText variant="display">Welcome back</AppText>
          <AppText color={colors.textMuted}>Track your collection and trade at the show.</AppText>
        </View>
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
        <Button title="Create an account" variant="ghost" onPress={() => navigation.navigate('Register')} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center' },
  header: { gap: spacing.sm, marginBottom: spacing.lg },
});
