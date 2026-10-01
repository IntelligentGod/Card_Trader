import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { errorMessage } from '../../api/client';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Controls';
import { Screen } from '../../components/Screen';
import { Surface } from '../../components/Surface';
import type { RootScreenProps } from '../../navigation/types';
import { colors, spacing } from '../../theme';
import { validateBroadcast } from './adminForm';
import { useAdminBroadcast } from './hooks';

/** SUPER_ADMIN: an announcement notification to every active user. */
export function AdminBroadcastScreen({ navigation }: RootScreenProps<'AdminBroadcast'>) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);
  const send = useAdminBroadcast();
  const errors = validateBroadcast(title, message);

  const submit = () => {
    setTouched(true);
    if (Object.keys(errors).length > 0) return;
    Alert.alert('Send to every active user?', 'Everyone gets this as a notification. It can’t be recalled.', [
      { text: 'Back', style: 'cancel' },
      {
        text: 'Send',
        onPress: () =>
          send.mutate(
            { title: title.trim(), message: message.trim() },
            {
              onSuccess: ({ recipients }) => {
                Alert.alert('Announcement sent', `Delivered to ${recipients.toLocaleString('en-US')} ${recipients === 1 ? 'user' : 'users'}.`);
                navigation.goBack();
              },
            },
          ),
      },
    ]);
  };

  return (
    <Screen>
      <Surface style={styles.group}>
        <AppText color={colors.textMuted}>Sent as an in-app notification to every active account. Keep it short and clear.</AppText>
      </Surface>
      <TextField
        label="Title"
        value={title}
        onChangeText={setTitle}
        maxLength={120}
        hint={`${title.trim().length}/120`}
        error={touched || title ? errors.title : null}
      />
      <TextField
        label="Message"
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={300}
        hint={`${message.trim().length}/300`}
        error={touched || message ? errors.message : null}
      />
      {send.error ? <AppText color={colors.negative}>{errorMessage(send.error)}</AppText> : null}
      <Button title="Send announcement" icon="megaphone-outline" loading={send.isPending} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
});
