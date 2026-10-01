import { useState } from 'react';
import { StyleSheet } from 'react-native';
import type { AdminCardDetail } from '@card-trader/shared';
import { errorMessage } from '../../api/client';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { CardArt } from '../../components/CardArt';
import { TextField } from '../../components/Controls';
import { Screen } from '../../components/Screen';
import { SkeletonBlock } from '../../components/Skeleton';
import { ErrorState } from '../../components/States';
import { Surface } from '../../components/Surface';
import type { RootScreenProps } from '../../navigation/types';
import { colors, spacing } from '../../theme';
import { cardFormFrom, diffCard, REASON_MAX, validateCardForm, type CardForm } from './adminForm';
import { useAdminCard, useAdminUpdateCard } from './hooks';

export function AdminEditCardScreen({ route, navigation }: RootScreenProps<'AdminEditCard'>) {
  const card = useAdminCard(route.params.cardId);

  if (card.isPending) {
    return (
      <Screen>
        <SkeletonBlock height={320} />
      </Screen>
    );
  }
  if (card.error) return <ErrorState error={card.error} onRetry={() => void card.refetch()} />;
  return <EditCardForm card={card.data} onDone={() => navigation.goBack()} />;
}

function EditCardForm({ card, onDone }: { card: AdminCardDetail; onDone: () => void }) {
  const [form, setForm] = useState<CardForm>(() => cardFormFrom(card));
  const [reason, setReason] = useState('');
  const update = useAdminUpdateCard(card.id);
  const set = (key: keyof CardForm) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const errors = validateCardForm(form);
  const body = diffCard(card, form, reason);
  const changed = Object.keys(body).length > 0;
  const valid = Object.keys(errors).length === 0 && reason.length <= REASON_MAX;
  const previewUrl = form.imageUrl.trim() && !errors.imageUrl ? form.imageUrl.trim() : null;

  return (
    <Screen>
      <Surface style={styles.preview}>
        <CardArt imageUrl={previewUrl} name={form.name || card.name} category={card.category} width={96} cardNumber={form.cardNumber} />
        <AppText variant="caption" color={colors.textMuted} align="center">
          {card.set.name}
        </AppText>
      </Surface>
      <TextField label="Name" value={form.name} onChangeText={set('name')} maxLength={120} error={errors.name} />
      <TextField label="Card number" value={form.cardNumber} onChangeText={set('cardNumber')} autoCapitalize="none" maxLength={32} error={errors.cardNumber} />
      <TextField label="Variant" placeholder="e.g. Holo, Reverse Holo" value={form.variant} onChangeText={set('variant')} maxLength={80} error={errors.variant} />
      <TextField label="Subject" placeholder="Character or player" value={form.subject} onChangeText={set('subject')} maxLength={120} error={errors.subject} />
      <TextField label="Rarity" value={form.rarity} onChangeText={set('rarity')} maxLength={40} error={errors.rarity} />
      <TextField
        label="Image URL"
        placeholder="https://…"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        value={form.imageUrl}
        onChangeText={set('imageUrl')}
        maxLength={500}
        error={errors.imageUrl}
      />
      <TextField label="Reason (saved in the audit log)" placeholder="Optional" value={reason} onChangeText={setReason} multiline maxLength={REASON_MAX} />
      {update.error ? <AppText color={colors.negative}>{errorMessage(update.error)}</AppText> : null}
      <Button
        title={changed ? 'Save changes' : 'No changes'}
        disabled={!changed || !valid}
        loading={update.isPending}
        onPress={() => update.mutate(body, { onSuccess: onDone })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', gap: spacing.sm },
});
