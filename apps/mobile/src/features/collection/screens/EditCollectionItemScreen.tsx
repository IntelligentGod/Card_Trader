import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { AppText } from '../../../components/AppText';
import { SkeletonBlock } from '../../../components/Skeleton';
import { ErrorState } from '../../../components/States';
import type { RootScreenProps } from '../../../navigation/types';
import { makeStyles, spacing, useTheme } from '../../../theme';
import { CollectionItemForm } from '../components/CollectionItemForm';
import { ScreenBackground } from '../../../components/ScreenBackground';
import { useCollectionItem, useUpdateItem } from '../hooks';

export function EditCollectionItemScreen({ route, navigation }: RootScreenProps<'EditCollectionItem'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { itemId } = route.params;
  const item = useCollectionItem(itemId);
  const update = useUpdateItem(itemId);

  if (item.isPending) return <SkeletonBlock height={400} />;
  if (item.error) return <ErrorState error={item.error} onRetry={() => void item.refetch()} />;
  const data = item.data;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenBackground />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <AppText variant="heading">{data.card.name}</AppText>
        {data.lockedInTrade ? (
          <AppText color={colors.warning}>This card is in an accepted trade; condition and quantity can’t change until it completes.</AppText>
        ) : null}
        <CollectionItemForm
          initial={{
            condition: data.condition,
            gradingCompany: data.gradingCompany,
            grade: data.grade,
            certNumber: data.certNumber,
            quantity: data.quantity,
            purchasePriceCents: data.purchasePriceCents,
            purchaseDate: data.purchaseDate,
            notes: data.notes,
            listingStatus: data.listingStatus,
            askingPriceCents: data.askingPriceCents,
            customImageKey: data.customImageKey,
            imageUrl: data.customImageKey ? data.imageUrl : null,
            backImageKey: data.backImageKey,
            backImageUrl: data.backImageUrl,
          }}
          submitLabel="Save changes"
          submitting={update.isPending}
          error={update.error}
          onSubmit={(values) => update.mutate(values, { onSuccess: () => navigation.goBack() })}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  flex: { flex: 1 },
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
}));
