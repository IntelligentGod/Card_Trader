import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { errorMessage } from '../../api/client';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Controls';
import { Screen } from '../../components/Screen';
import { Surface } from '../../components/Surface';
import type { RootScreenProps } from '../../navigation/types';
import { colors, spacing } from '../../theme';
import { normalizeUsername } from '../auth/validation';
import { PASSWORD_MAX, validateCreateAdmin, type CreateAdminForm } from './adminForm';
import { useAdminCreateAdmin } from './hooks';

const EMPTY: CreateAdminForm = { email: '', username: '', displayName: '', password: '', confirm: '' };

/** SUPER_ADMIN: a new ADMIN account with a temporary password. */
export function AdminCreateAdminScreen({ navigation }: RootScreenProps<'AdminCreateAdmin'>) {
  const [form, setForm] = useState<CreateAdminForm>(EMPTY);
  const [touched, setTouched] = useState(false);
  const create = useAdminCreateAdmin();
  const set = (key: keyof CreateAdminForm) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const errors = validateCreateAdmin(form);
  const show = (key: keyof CreateAdminForm) => (touched || form[key] ? errors[key] : null);

  const submit = () => {
    setTouched(true);
    if (Object.keys(errors).length > 0) return;
    create.mutate(
      {
        email: form.email.trim(),
        username: normalizeUsername(form.username),
        displayName: form.displayName.trim(),
        temporaryPassword: form.password,
      },
      {
        onSuccess: (admin) => {
          // never keep the temporary password around
          setForm(EMPTY);
          create.reset();
          navigation.replace('AdminUser', { publicId: admin.publicId });
        },
      },
    );
  };

  return (
    <Screen>
      <Surface style={styles.group}>
        <AppText color={colors.textMuted}>
          The new admin signs in with the temporary password, must change it right away and verify their email. Share it with them
          through a safe channel; it is not shown again.
        </AppText>
      </Surface>
      <TextField
        label="Email"
        value={form.email}
        onChangeText={set('email')}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        maxLength={254}
        error={show('email')}
      />
      <TextField label="Username" value={form.username} onChangeText={set('username')} autoCapitalize="none" autoCorrect={false} maxLength={21} error={show('username')} />
      <TextField label="Display name" value={form.displayName} onChangeText={set('displayName')} maxLength={40} error={show('displayName')} />
      <TextField
        label="Temporary password"
        value={form.password}
        onChangeText={set('password')}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        textContentType="newPassword"
        maxLength={PASSWORD_MAX}
        hint="10–128 characters"
        error={show('password')}
      />
      <TextField
        label="Confirm password"
        value={form.confirm}
        onChangeText={set('confirm')}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        textContentType="newPassword"
        maxLength={PASSWORD_MAX}
        error={show('confirm')}
      />
      {create.error ? <AppText color={colors.negative}>{errorMessage(create.error)}</AppText> : null}
      <Button title="Create admin" icon="person-add-outline" loading={create.isPending} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
});
