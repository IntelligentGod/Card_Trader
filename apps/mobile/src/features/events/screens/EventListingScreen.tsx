import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CATEGORY_LABELS, CONDITION_LABELS, formatCents } from '@card-trader/shared';
import { errorMessage } from '../../../api/client';
import { api } from '../../../api/endpoints';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { CardArt } from '../../../components/CardArt';
import { SectionHeader } from '../../../components/Controls';
import { ListingBadge } from '../../../components/ListingBadge';
import { Avatar } from '../../../components/Profile';
import { Disclaimer, Screen } from '../../../components/Screen';
import { SkeletonBlock } from '../../../components/Skeleton';
import { Surface } from '../../../components/Surface';
import type { RootScreenProps } from '../../../navigation/types';
import { useSession } from '../../../stores/session';
import { colors, radius, spacing } from '../../../theme';
import { cardSubtitle, formatDateShort } from '../../../utils/format';
import { useStartTrade } from '../../trades/useStartTrade';

/** "View Card" from Search This Event: the card, its comps, and who has it at which table. */
export function EventListingScreen({ route, navigation }: RootScreenProps<'EventListing'>) {
  const { eventId, result } = route.params;
  const { item, vendor, vendorInfo, tableNumber } = result;
  const ownPublicId = useSession((s) => s.user?.publicId);
  const isMine = vendor.publicId === ownPublicId;
  const comps = useQuery({
    queryKey: ['cards', item.card.id, 'market', item.tierKey],
    queryFn: () => api.cards.marketValue(item.card.id, item.tierKey),
  });
  const startTrade = useStartTrade();

  useEffect(() => navigation.setOptions({ title: item.card.name }), [navigation, item.card.name]);

  return (
    <Screen
      footer={
        isMine ? null : (
          <View style={styles.footer}>
            {startTrade.error ? <AppText color={colors.negative}>{errorMessage(startTrade.error)}</AppText> : null}
            <Button
              title="Start trade for this card"
              icon="swap-horizontal"
              loading={startTrade.isPending}
              onPress={() =>
                startTrade.mutate(
                  { publicId: vendor.publicId, collectionItemIds: [item.id], eventId },
                  { onSuccess: (trade) => navigation.navigate('TradeBuilder', { tradeId: trade.id }) },
                )
              }
            />
          </View>
        )
      }
    >
      <View style={styles.photos}>
        <CardArt imageUrl={item.imageUrl} name={item.card.name} category={item.card.category} cardNumber={item.card.cardNumber} width={item.backImageUrl ? 130 : 160} />
        {item.backImageUrl ? <CardArt imageUrl={item.backImageUrl} name={`${item.card.name} (back)`} category={item.card.category} width={130} /> : null}
      </View>

      <Surface style={styles.gap}>
        <AppText variant="label" color={colors.textMuted}>
          {CATEGORY_LABELS[item.card.category]}
        </AppText>
        <AppText variant="title">{item.card.name}</AppText>
        <AppText color={colors.textMuted}>{cardSubtitle(item.card)}</AppText>
        <View style={styles.row}>
          <AppText variant="bodyStrong" color={colors.primary}>
            {item.tierLabel}
          </AppText>
          <ListingBadge status={item.listingStatus} askingPriceCents={item.askingPriceCents} />
        </View>
        {item.condition !== 'GRADED' ? <Detail label="Condition" value={CONDITION_LABELS[item.condition]} /> : null}
        {item.certNumber ? <Detail label="Cert #" value={item.certNumber} /> : null}
        {item.quantity > 1 ? <Detail label="Available" value={`${item.quantity} copies`} /> : null}
        {item.askingPriceCents !== null ? <Detail label="Asking price" value={formatCents(item.askingPriceCents)} /> : null}
        <Detail label="Estimated value" value={item.estimatedValueCents !== null ? formatCents(item.estimatedValueCents) : 'Not priced yet'} />
      </Surface>

      <Surface>
        <SectionHeader title="Last 3 comparable sales" />
        {comps.isPending ? (
          <SkeletonBlock height={64} />
        ) : comps.data && comps.data.recentSales.length > 0 ? (
          comps.data.recentSales.map((sale) => (
            <View key={sale.id} style={styles.saleRow}>
              <AppText variant="bodyStrong" style={styles.flex}>
                {formatCents(sale.priceCents)}
              </AppText>
              <AppText color={colors.textMuted}>
                {formatDateShort(sale.soldAt)} · {sale.source}
              </AppText>
            </View>
          ))
        ) : (
          <AppText color={colors.textMuted}>No comparable sales yet.</AppText>
        )}
      </Surface>

      <Pressable
        style={({ pressed }) => [styles.vendor, pressed && styles.pressed]}
        onPress={() => navigation.navigate('OtherUserProfile', { publicId: vendor.publicId, eventId })}
        accessibilityRole="button"
        accessibilityLabel="View vendor"
      >
        <Avatar url={vendorInfo?.logoUrl ?? vendor.avatarUrl} name={vendorInfo?.businessName ?? vendor.displayName} size={48} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {vendorInfo?.businessName ?? vendor.displayName}
          </AppText>
          <AppText variant="caption" color={colors.textMuted}>
            @{vendor.username} · ★ {vendor.ratingAverage?.toFixed(1) ?? 'new'} · {vendor.completedTradeCount} trades
          </AppText>
        </View>
        {tableNumber ? (
          <View style={styles.table}>
            <AppText variant="caption" color={colors.primary}>
              Table
            </AppText>
            <AppText variant="heading" color={colors.primary}>
              {tableNumber}
            </AppText>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
      </Pressable>
      <Disclaimer />
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <AppText color={colors.textMuted}>{label}</AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  photos: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flex: { flex: 1 },
  detail: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg },
  saleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  vendor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.85 },
  table: { alignItems: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  footer: { gap: spacing.sm },
});
