import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { formatCents } from '@card-trader/shared';
import { errorMessage } from '../../../api/client';
import { api } from '../../../api/endpoints';
import { queryKeys } from '../../../api/queryKeys';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { CardRow } from '../../../components/CardRow';
import { ListingBadge } from '../../../components/ListingBadge';
import { SkeletonList } from '../../../components/Skeleton';
import { EmptyState, ErrorState } from '../../../components/States';
import { ScreenBackground } from '../../../components/ScreenBackground';
import type { RootScreenProps } from '../../../navigation/types';
import { makeStyles, spacing, useTheme } from '../../../theme';
import { cardSubtitle } from '../../../utils/format';
import { invalidateCollection, useCollectionList } from '../../collection/hooks';

/**
 * Approved vendors pick which of their EXISTING cards they bring. Only cards
 * listed for trade and/or sale qualify; nothing is copied.
 */
export function EventInventoryScreen({ route, navigation }: RootScreenProps<'EventInventory'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { eventId } = route.params;
  const client = useQueryClient();
  const current = useQuery({ queryKey: queryKeys.eventMyInventory(eventId), queryFn: () => api.events.myInventory(eventId) });
  const list = useCollectionList({ sort: 'value_desc' });
  const [selected, setSelected] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (current.data && selected === null) setSelected(new Set(current.data.collectionItemIds));
  }, [current.data, selected]);

  const all = list.data?.pages.flatMap((p) => p.data) ?? [];
  const listed = useMemo(() => all.filter((i) => i.listingStatus !== 'PERSONAL'), [all]);
  const personalCount = all.length - listed.length;
  const chosen = selected ?? new Set<string>();
  const chosenValue = listed.filter((i) => chosen.has(i.id)).reduce((sum, i) => sum + (i.totalValueCents ?? 0), 0);

  const save = useMutation({
    mutationFn: () => api.events.setMyInventory(eventId, [...chosen]),
    onSuccess: (result) => {
      client.setQueryData(queryKeys.eventMyInventory(eventId), result);
      void client.invalidateQueries({ queryKey: queryKeys.event(eventId) });
      invalidateCollection(client);
      navigation.goBack();
    },
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (list.isPending || current.isPending) return <SkeletonList rows={5} />;
  if (list.error || current.error) {
    return (
      <ErrorState
        error={list.error ?? current.error}
        onRetry={() => {
          void list.refetch();
          void current.refetch();
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScreenBackground />
      <FlatList
        data={listed}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <AppText color={colors.textMuted} style={styles.flex}>
              {personalCount > 0
                ? `${personalCount} personal-collection cards are hidden. Mark a card For Trade or For Sale to bring it.`
                : 'Select the cards you are bringing. Attendees can search them before and during the show.'}
            </AppText>
            {listed.length > 0 ? (
              <Button
                title={chosen.size === listed.length ? 'None' : 'All'}
                variant="ghost"
                compact
                onPress={() => setSelected(chosen.size === listed.length ? new Set() : new Set(listed.map((i) => i.id)))}
              />
            ) : null}
          </View>
        }
        ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null}
        ListEmptyComponent={
          <EmptyState
            icon="pricetag-outline"
            title="No cards listed for trade or sale"
            message="Open a card in Inventory and set its status to For Trade, For Sale or Trade + Sale."
          />
        }
        renderItem={({ item }) => (
          <CardRow
            name={item.card.name}
            subtitle={cardSubtitle(item.card)}
            tierLabel={item.tierLabel}
            category={item.card.category}
            imageUrl={item.imageUrl}
            valueCents={item.totalValueCents}
            quantity={item.quantity}
            selected={chosen.has(item.id)}
            onPress={() => toggle(item.id)}
            trailing={
              <View style={styles.trailing}>
                <ListingBadge status={item.listingStatus} askingPriceCents={item.askingPriceCents} />
                <Ionicons
                  name={chosen.has(item.id) ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={chosen.has(item.id) ? colors.primary : colors.textSubtle}
                />
              </View>
            }
          />
        )}
      />
      <View style={styles.footer}>
        <AppText color={colors.textMuted}>
          Bringing {chosen.size} {chosen.size === 1 ? 'card' : 'cards'} · {formatCents(chosenValue)} estimated
        </AppText>
        {save.error ? <AppText color={colors.negative}>{errorMessage(save.error)}</AppText> : null}
        <Button title="Save event inventory" icon="checkmark" loading={save.isPending} onPress={() => save.mutate()} />
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, flexGrow: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  flex: { flex: 1 },
  trailing: { alignItems: 'flex-end', gap: spacing.xs },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
}));
