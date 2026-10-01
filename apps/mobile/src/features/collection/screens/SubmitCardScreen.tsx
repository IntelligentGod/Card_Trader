import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CARD_CATEGORIES, CATEGORY_LABELS, type CardCategory, type CardSetSummary } from '@card-trader/shared';
import { ApiError, errorMessage } from '../../../api/client';
import { api } from '../../../api/endpoints';
import { queryKeys } from '../../../api/queryKeys';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { ChipRow, TextField } from '../../../components/Controls';
import { Screen } from '../../../components/Screen';
import type { RootScreenProps } from '../../../navigation/types';
import { categoryColors, colors, radius, spacing } from '../../../theme';

/** Adds a card missing from the catalog. It stays "pending review" and visible only to its submitter. */
export function SubmitCardScreen({ navigation }: RootScreenProps<'SubmitCard'>) {
  const client = useQueryClient();
  const [category, setCategory] = useState<CardCategory>('POKEMON');
  const [setSearch, setSetSearch] = useState('');
  const setQuery = useDeferredValue(setSearch.trim());
  const [set, setSet] = useState<CardSetSummary | null>(null);
  const [name, setName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [variant, setVariant] = useState('');
  const [subject, setSubject] = useState('');

  const sets = useQuery({ queryKey: queryKeys.sets(category, setQuery), queryFn: () => api.cards.sets({ category, q: setQuery || undefined }) });

  const submit = useMutation({
    mutationFn: () =>
      api.cards.submit({
        setId: set!.id,
        name: name.trim(),
        cardNumber: cardNumber.trim(),
        variant: variant.trim() || undefined,
        subject: subject.trim() || undefined,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['cards'] });
      navigation.goBack();
    },
  });

  const existingId =
    submit.error instanceof ApiError && submit.error.code === 'CARD_EXISTS'
      ? (submit.error.details as { cardId?: string } | undefined)?.cardId
      : undefined;

  return (
    <Screen>
      <AppText color={colors.textMuted}>Submitted cards are visible to you right away and reviewed before appearing for others.</AppText>
      <ChipRow
        options={CARD_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c], color: categoryColors[c].main }))}
        value={category}
        onChange={(value) => {
          setCategory(value ?? 'POKEMON');
          setSet(null);
        }}
      />
      {set ? (
        <Pressable style={styles.setSelected} onPress={() => setSet(null)}>
          <AppText variant="bodyStrong">{set.name}</AppText>
          <AppText variant="caption" color={colors.primary}>
            Change set
          </AppText>
        </Pressable>
      ) : (
        <View style={styles.group}>
          <TextField label="Set" placeholder="Search sets" value={setSearch} onChangeText={setSetSearch} />
          {(sets.data ?? []).slice(0, 8).map((s) => (
            <Pressable key={s.id} style={styles.setOption} onPress={() => setSet(s)}>
              <AppText>{s.name}</AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {[s.code, s.year].filter(Boolean).join(' · ')}
              </AppText>
            </Pressable>
          ))}
        </View>
      )}
      <TextField label="Card name" value={name} onChangeText={setName} maxLength={120} />
      <TextField label="Card number" value={cardNumber} onChangeText={setCardNumber} maxLength={32} autoCapitalize="characters" />
      <TextField label="Variant (optional)" placeholder="Holo, Refractor, Alt Art…" value={variant} onChangeText={setVariant} maxLength={80} />
      <TextField
        label={category === 'SPORTS' ? 'Player (optional)' : 'Character (optional)'}
        value={subject}
        onChangeText={setSubject}
        maxLength={120}
      />
      {submit.error ? <AppText color={colors.negative}>{errorMessage(submit.error)}</AppText> : null}
      {existingId ? <AppText color={colors.textMuted}>Search for it by number on the previous screen.</AppText> : null}
      <Button
        title="Submit card"
        onPress={() => submit.mutate()}
        loading={submit.isPending}
        disabled={!set || !name.trim() || !cardNumber.trim()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  setSelected: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md, gap: 2 },
  setOption: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md },
});
