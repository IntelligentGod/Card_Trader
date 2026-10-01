import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { api } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Controls';
import { Screen } from '../../components/Screen';
import type { RootScreenProps } from '../../navigation/types';
import { colors, spacing } from '../../theme';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

export function ReviewUserScreen({ route, navigation }: RootScreenProps<'ReviewUser'>) {
  const { tradeId, displayName } = route.params;
  const client = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const submit = useMutation({
    mutationFn: () => api.trades.review(tradeId, { rating, comment: comment.trim() || null }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.trade(tradeId) });
      void client.invalidateQueries({ queryKey: ['users'] });
      navigation.goBack();
    },
  });

  return (
    <Screen>
      <AppText variant="title">How was trading with {displayName}?</AppText>
      <AppText color={colors.textMuted}>Your review appears on their public profile.</AppText>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => setRating(star)} hitSlop={6} accessibilityLabel={`${star} stars`} accessibilityRole="button">
            <Ionicons name={rating >= star ? 'star' : 'star-outline'} size={42} color={colors.warning} />
          </Pressable>
        ))}
      </View>
      <AppText variant="bodyStrong" align="center">
        {LABELS[rating] ?? ''}
      </AppText>
      <TextField label="Comment (optional)" value={comment} onChangeText={setComment} multiline maxLength={1000} placeholder="Fast, friendly, cards as described…" />
      {submit.error ? <AppText color={colors.negative}>{errorMessage(submit.error)}</AppText> : null}
      <Button title="Submit review" onPress={() => submit.mutate()} disabled={rating === 0} loading={submit.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg },
});
