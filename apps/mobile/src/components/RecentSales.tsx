import { Linking, View } from 'react-native';
import { formatCents, type CardSummary, type MarketValueResponse } from '@card-trader/shared';
import { makeStyles, spacing, useTheme } from '../theme';
import { formatDateShort } from '../utils/format';
import { oneThirtyPointQuery, oneThirtyPointUrl } from '../utils/onethirtypoint';
import { AppText } from './AppText';
import { Button } from './Button';
import { SectionHeader } from './Controls';
import { PriceText } from './PriceText';
import { SkeletonBlock } from './Skeleton';
import { Surface } from './Surface';

interface RecentSalesProps {
  card: CardSummary;
  tierKey: string;
  market: MarketValueResponse | undefined;
  isPending: boolean;
}

/** The 3 most recent comparable sales, the suggested price (their average), and a link to 130point's sold listings. */
export function RecentSales({ card, tierKey, market, isPending }: RecentSalesProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const sales = market?.recentSales ?? [];
  const query = oneThirtyPointQuery(card, tierKey);

  return (
    <Surface style={styles.gap}>
      <SectionHeader title="Recent 3 sold prices" />
      {isPending ? (
        <SkeletonBlock height={72} />
      ) : sales.length > 0 ? (
        sales.map((sale, index) => (
          <View key={sale.id} style={styles.saleRow}>
            <AppText color={colors.textMuted}>{index + 1}.</AppText>
            <AppText variant="bodyStrong" style={styles.flex}>
              {formatCents(sale.priceCents)}
            </AppText>
            <AppText color={colors.textMuted}>
              {formatDateShort(sale.soldAt)} · {sale.source}
            </AppText>
          </View>
        ))
      ) : (
        <AppText color={colors.textMuted}>No comparable sales yet. Prices refresh in the background.</AppText>
      )}

      {market && market.valueCents !== null ? (
        <View style={styles.suggested} testID="suggested-price">
          <View style={styles.flex}>
            <AppText variant="label" color={colors.textMuted}>
              Suggested price
            </AppText>
            <AppText variant="caption" color={colors.textMuted}>
              Average of the last {market.sampleSize} {market.sampleSize === 1 ? 'sale' : 'sales'}
            </AppText>
          </View>
          <PriceText cents={market.valueCents} variant="title" color={colors.primary} />
        </View>
      ) : null}

      <Button title="View sold prices on 130point" icon="open-outline" variant="secondary" onPress={() => void Linking.openURL(oneThirtyPointUrl(query))} />
      <AppText variant="caption" color={colors.textSubtle} selectable>
        130point search: {query}
      </AppText>
    </Surface>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  gap: { gap: spacing.sm },
  flex: { flex: 1 },
  saleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  suggested: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
}));
