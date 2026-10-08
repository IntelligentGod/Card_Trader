import { useDeferredValue, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { CARD_CATEGORIES, CATEGORY_LABELS, type CardCategory, type CatalogSource } from '@card-trader/shared';
import { AppText } from '../../components/AppText';
import { CardRow } from '../../components/CardRow';
import { ChipRow, TextField } from '../../components/Controls';
import { SkeletonList } from '../../components/Skeleton';
import { EmptyState, ErrorState } from '../../components/States';
import { ScreenBackground } from '../../components/ScreenBackground';
import type { RootScreenProps } from '../../navigation/types';
import { makeStyles, spacing, useTheme } from '../../theme';
import { cardSubtitle } from '../../utils/format';
import { CATALOG_SOURCE_LABELS } from './adminText';
import { VerifiedBadge } from './components';
import { useAdminCardList } from './hooks';

const SOURCES: { value: CatalogSource; label: string }[] = (['SEED', 'IMPORT', 'USER_SUBMITTED'] as const).map((s) => ({
  value: s,
  label: CATALOG_SOURCE_LABELS[s],
}));

type Verified = 'yes' | 'no';
const VERIFIED: { value: Verified; label: string }[] = [
  { value: 'yes', label: 'Verified' },
  { value: 'no', label: 'Unverified' },
];

export function AdminCardsScreen({ navigation }: RootScreenProps<'AdminCards'>) {
  const styles = useStyles();
  const { categoryColors, colors } = useTheme();
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const [category, setCategory] = useState<CardCategory | undefined>();
  const [source, setSource] = useState<CatalogSource | undefined>();
  const [verified, setVerified] = useState<Verified | undefined>();
  const filters = { q: q || undefined, category, source, verified: verified === undefined ? undefined : verified === 'yes' };
  const list = useAdminCardList(filters);
  const cards = list.data?.pages.flatMap((p) => p.data) ?? [];
  const filtered = !!(q || category || source || verified);

  return (
    <View style={styles.container}>
      <ScreenBackground />
      <View style={styles.header}>
        <TextField
          placeholder="Search name, number, subject or set"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          returnKeyType="search"
        />
        <ChipRow
          options={CARD_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c], color: categoryColors[c].main }))}
          value={category}
          onChange={setCategory}
          allowNone="All"
        />
        <ChipRow options={SOURCES} value={source} onChange={setSource} allowNone="Any source" />
        <ChipRow options={VERIFIED} value={verified} onChange={setVerified} allowNone="Any" />
      </View>

      {list.isPending ? (
        <SkeletonList />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => (
            <CardRow
              name={item.name}
              subtitle={cardSubtitle(item)}
              tierLabel={CATALOG_SOURCE_LABELS[item.source]}
              category={item.category}
              imageUrl={item.imageUrl}
              valueCents={item.topValueCents}
              onPress={() => navigation.navigate('AdminCard', { cardId: item.id })}
              trailing={<VerifiedBadge verified={item.isVerified} />}
              footer={
                <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
                  {item.collectionItemCount} in collections
                  {item.submittedBy ? ` · by ${item.submittedBy.displayName}` : ''}
                </AppText>
              }
            />
          )}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
          }}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.primary} />}
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null}
          ListEmptyComponent={
            <EmptyState icon="albums-outline" title="No cards found" message={filtered ? 'Try other filters.' : undefined} />
          }
        />
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  list: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl, flexGrow: 1 },
}));
