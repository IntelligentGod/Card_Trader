import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { CATEGORY_LABELS, formatCents } from '@card-trader/shared';
import { errorMessage } from '../../api/client';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { CardArt } from '../../components/CardArt';
import { TextField } from '../../components/Controls';
import { PriceText } from '../../components/PriceText';
import { Screen } from '../../components/Screen';
import { SkeletonBlock } from '../../components/Skeleton';
import { ErrorState } from '../../components/States';
import { Surface } from '../../components/Surface';
import type { RootScreenProps } from '../../navigation/types';
import { colors, spacing } from '../../theme';
import { formatDateLong } from '../../utils/format';
import { REASON_MAX } from './adminForm';
import { CATALOG_SOURCE_LABELS } from './adminText';
import { AuditEntryCard, StatTile, VerifiedBadge } from './components';
import { useAdminCard, useAdminUpdateCard } from './hooks';

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.detail}>
      <AppText color={colors.textMuted}>{label}</AppText>
      <AppText style={styles.detailValue} selectable>
        {value || '—'}
      </AppText>
    </View>
  );
}

export function AdminCardScreen({ route, navigation }: RootScreenProps<'AdminCard'>) {
  const { cardId } = route.params;
  const card = useAdminCard(cardId);
  const update = useAdminUpdateCard(cardId);
  const [reason, setReason] = useState('');

  const loaded = !!card.data;
  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        loaded ? (
          <Pressable onPress={() => navigation.navigate('AdminEditCard', { cardId })} hitSlop={8} accessibilityRole="button">
            <AppText variant="bodyStrong" color={colors.primary}>
              Edit
            </AppText>
          </Pressable>
        ) : null,
    });
  }, [cardId, loaded, navigation]);

  if (card.isPending) {
    return (
      <Screen>
        <SkeletonBlock height={200} />
        <SkeletonBlock height={160} />
      </Screen>
    );
  }
  if (card.error) return <ErrorState error={card.error} onRetry={() => void card.refetch()} />;
  const c = card.data;

  const toggleVerified = () => {
    const next = !c.isVerified;
    Alert.alert(
      next ? 'Verify this card?' : 'Unverify this card?',
      next
        ? 'Verified cards are part of the public catalog. The change is saved in the audit log.'
        : 'Unverified cards are treated like new user submissions until verified again. The change is saved in the audit log.',
      [
        { text: 'Back', style: 'cancel' },
        {
          text: next ? 'Verify' : 'Unverify',
          style: next ? 'default' : 'destructive',
          onPress: () => update.mutate({ isVerified: next, reason: reason.trim() || null }, { onSuccess: () => setReason('') }),
        },
      ],
    );
  };

  return (
    <Screen refreshing={card.isRefetching} onRefresh={() => void card.refetch()}>
      <Surface style={styles.header}>
        <CardArt imageUrl={c.imageUrl} name={c.name} category={c.category} width={120} cardNumber={c.cardNumber} />
        <AppText variant="title" align="center">
          {c.name}
        </AppText>
        <AppText color={colors.textMuted} align="center">
          {c.set.name} · #{c.cardNumber}
          {c.variant ? ` · ${c.variant}` : ''}
        </AppText>
        <VerifiedBadge verified={c.isVerified} />
      </Surface>

      <Surface style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          Usage
        </AppText>
        <View style={styles.grid}>
          <StatTile label="Owners" value={c.ownerCount} />
          <StatTile label="Copies" value={c.copies} hint={`${c.collectionItemCount} collection rows`} />
          <StatTile label="In trades" value={c.tradeItemCount} />
          <StatTile label="Top value" value={c.topValueCents === null ? '—' : formatCents(c.topValueCents)} />
        </View>
      </Surface>

      <Surface style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          Details
        </AppText>
        <Detail label="Category" value={CATEGORY_LABELS[c.category]} />
        <Detail label="Set" value={`${c.set.name} (${c.set.code})${c.set.year ? ` · ${c.set.year}` : ''}`} />
        <Detail label="Subject" value={c.subject} />
        <Detail label="Rarity" value={c.rarity} />
        <Detail label="Source" value={CATALOG_SOURCE_LABELS[c.source]} />
        <Detail label="External ref" value={c.externalRef} />
        <Detail label="Image URL" value={c.imageUrl} />
        <Detail label="Added" value={formatDateLong(c.createdAt)} />
        <Detail label="Updated" value={formatDateLong(c.updatedAt)} />
        {c.submittedBy ? (
          <Pressable onPress={() => navigation.navigate('AdminUser', { publicId: c.submittedBy!.publicId })} style={styles.detail}>
            <AppText color={colors.textMuted}>Submitted by</AppText>
            <AppText variant="bodyStrong" color={colors.primary} style={styles.detailValue}>
              {c.submittedBy.displayName}
            </AppText>
          </Pressable>
        ) : null}
      </Surface>

      <Surface style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          Market values
        </AppText>
        {c.marketValues.length === 0 ? (
          <AppText color={colors.textMuted}>No sales recorded for this card yet.</AppText>
        ) : (
          c.marketValues.map((mv) => (
            <View key={mv.tierKey} style={styles.tier}>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{mv.tierLabel}</AppText>
                <AppText variant="caption" color={colors.textMuted}>
                  {mv.confidence.toLowerCase()} confidence · {mv.sampleSize} sales
                  {mv.lastSaleAt ? ` · last ${formatDateLong(mv.lastSaleAt)}` : ''}
                </AppText>
              </View>
              <PriceText cents={mv.valueCents} />
            </View>
          ))
        )}
      </Surface>

      <Surface style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          Verification
        </AppText>
        <TextField label="Reason (saved in the audit log)" placeholder="Optional" value={reason} onChangeText={setReason} maxLength={REASON_MAX} />
        {update.error ? <AppText color={colors.negative}>{errorMessage(update.error)}</AppText> : null}
        <Button
          title={c.isVerified ? 'Unverify card' : 'Verify card'}
          icon={c.isVerified ? 'close-circle-outline' : 'checkmark-circle-outline'}
          variant={c.isVerified ? 'danger' : 'primary'}
          loading={update.isPending}
          onPress={toggleVerified}
          testID="admin-card-verify"
        />
      </Surface>

      <View style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          History
        </AppText>
        {c.history.length === 0 ? (
          <AppText color={colors.textMuted}>No admin changes yet.</AppText>
        ) : (
          c.history.map((entry) => <AuditEntryCard key={entry.id} entry={entry} />)
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing.sm },
  group: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  detail: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg },
  detailValue: { flexShrink: 1, textAlign: 'right' },
  tier: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
