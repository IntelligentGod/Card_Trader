import { useInfiniteQuery } from '@tanstack/react-query';
import { useDeferredValue, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { CARD_CATEGORIES, CATEGORY_LABELS, type CardCategory, type CardSummary } from '@card-trader/shared';
import { api } from '../../../api/endpoints';
import { queryKeys } from '../../../api/queryKeys';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { CardArt } from '../../../components/CardArt';
import { ChipRow, TextField } from '../../../components/Controls';
import { SkeletonList } from '../../../components/Skeleton';
import { EmptyState, ErrorState } from '../../../components/States';
import type { RootScreenProps } from '../../../navigation/types';
import { makeStyles, radius, spacing, useTheme } from '../../../theme';
import { cardSubtitle } from '../../../utils/format';
import { CollectionItemForm } from '../components/CollectionItemForm';
import { ScreenBackground } from '../../../components/ScreenBackground';
import { useCreateItem } from '../hooks';

export function AddCardScreen({ navigation }: RootScreenProps<'AddCard'>) {
  const styles = useStyles();
  const { colors, categoryColors } = useTheme();
  // Built from the active theme, so it lives in the component (hooks can't run at module level).
  const categoryOptions = useMemo(
    () => CARD_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c], color: categoryColors[c].main })),
    [categoryColors],
  );
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const [category, setCategory] = useState<CardCategory | undefined>();
  const [selected, setSelected] = useState<CardSummary | null>(null);
  const create = useCreateItem();

  const results = useInfiniteQuery({
    queryKey: queryKeys.cardSearch(q, category),
    queryFn: ({ pageParam }) => api.cards.search({ q: q || undefined, category, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !selected,
  });
  const cards = results.data?.pages.flatMap((p) => p.data) ?? [];

  if (selected) {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenBackground />
        <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.selected}>
            <CardArt imageUrl={selected.imageUrl} name={selected.name} category={selected.category} width={72} />
            <View style={styles.flex}>
              <AppText variant="heading">{selected.name}</AppText>
              <AppText color={colors.textMuted}>{cardSubtitle(selected)}</AppText>
              <Pressable onPress={() => setSelected(null)} hitSlop={8}>
                <AppText variant="bodyStrong" color={colors.primary}>
                  Change card
                </AppText>
              </Pressable>
            </View>
          </View>
          <CollectionItemForm
            submitLabel="Add to collection"
            submitting={create.isPending}
            error={create.error}
            onSubmit={(values) =>
              create.mutate(
                { ...values, cardId: selected.id },
                { onSuccess: (item) => navigation.replace('CardDetails', { itemId: item.id }) },
              )
            }
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenBackground />
      <View style={styles.header}>
        <TextField
          placeholder="Search by name, player, character or number"
          value={search}
          onChangeText={setSearch}
          autoFocus
          returnKeyType="search"
        />
        <ChipRow options={categoryOptions} value={category} onChange={setCategory} allowNone="All" />
      </View>
      {results.isPending ? (
        <SkeletonList rows={5} />
      ) : results.error ? (
        <ErrorState error={results.error} onRetry={() => void results.refetch()} />
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(card) => card.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          onEndReached={() => {
            if (results.hasNextPage && !results.isFetchingNextPage) void results.fetchNextPage();
          }}
          ListFooterComponent={
            <View style={styles.footer}>
              {results.isFetchingNextPage ? <ActivityIndicator /> : null}
              <AppText color={colors.textMuted} align="center">
                Can’t find your card?
              </AppText>
              <Button title="Add a missing card" variant="secondary" onPress={() => navigation.navigate('SubmitCard')} />
            </View>
          }
          ListEmptyComponent={<EmptyState icon="search" title="No cards found" message="Try another spelling or the card number." />}
          renderItem={({ item }) => (
            <Pressable style={styles.result} onPress={() => setSelected(item)}>
              <CardArt imageUrl={item.imageUrl} name={item.name} category={item.category} width={44} />
              <View style={styles.flex}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {item.name}
                </AppText>
                <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
                  {cardSubtitle(item)}
                  {item.set.year ? ` · ${item.set.year}` : ''}
                </AppText>
                {!item.isVerified ? (
                  <AppText variant="caption" color={colors.warning}>
                    Pending review
                  </AppText>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, gap: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  result: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md },
  footer: { gap: spacing.sm, paddingVertical: spacing.xl },
  formContainer: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  selected: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md },
}));
