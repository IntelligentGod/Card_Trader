import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatCents, type TradeItemResponse, type TradeParticipantResponse } from '@card-trader/shared';
import { AppText } from '../../../components/AppText';
import { CardRow } from '../../../components/CardRow';
import { PriceText } from '../../../components/PriceText';
import { Surface } from '../../../components/Surface';
import { colors, spacing } from '../../../theme';

interface TradeSideProps {
  title: string;
  side: TradeParticipantResponse;
  editable?: boolean;
  onAdd?: () => void;
  onRemove?: (tradeItemId: string) => void;
  removingId?: string | null;
  /** final summary: cert numbers and the comps behind each value */
  showDetails?: boolean;
}

function ItemDetails({ item }: { item: TradeItemResponse }) {
  return (
    <View style={styles.details}>
      {item.certNumber ? (
        <AppText variant="caption" color={colors.textMuted}>
          Cert #{item.certNumber}
        </AppText>
      ) : null}
      {item.comps.length > 0 ? (
        <AppText variant="caption" color={colors.textMuted}>
          Comps: {item.comps.map((c) => formatCents(c.priceCents)).join(' · ')}
        </AppText>
      ) : (
        <AppText variant="caption" color={colors.textSubtle}>
          No comparable sales
        </AppText>
      )}
    </View>
  );
}

export function TradeSide({ title, side, editable, onAdd, onRemove, removingId, showDetails }: TradeSideProps) {
  return (
    <Surface style={styles.container}>
      <View style={styles.header}>
        <AppText variant="label" color={colors.textMuted}>
          {title}
        </AppText>
        {side.hasAcceptedCurrentVersion ? (
          <View style={styles.accepted}>
            <Ionicons name="checkmark-circle" size={14} color={colors.positive} />
            <AppText variant="caption" color={colors.positive}>
              Agreed
            </AppText>
          </View>
        ) : null}
      </View>

      {side.items.length === 0 ? (
        <AppText color={colors.textMuted}>No cards yet</AppText>
      ) : (
        side.items.map((item) => (
          <CardRow
            key={item.id}
            name={item.cardName}
            subtitle={[item.setName, `#${item.cardNumber}`, item.variant || null].filter(Boolean).join(' · ')}
            tierLabel={item.tierLabel}
            category={item.category}
            imageUrl={item.imageUrl}
            valueCents={item.lineTotalCents}
            quantity={item.quantity}
            footer={
              <>
                {item.unitValueCents === null ? (
                  <AppText variant="caption" color={colors.warning}>
                    No market estimate — counts as $0
                  </AppText>
                ) : null}
                {showDetails ? <ItemDetails item={item} /> : null}
              </>
            }
            trailing={
              editable && onRemove ? (
                <Pressable
                  onPress={() => onRemove(item.id)}
                  hitSlop={10}
                  disabled={removingId === item.id}
                  accessibilityLabel={`Remove ${item.cardName}`}
                >
                  <Ionicons name="close-circle" size={22} color={colors.textSubtle} />
                </Pressable>
              ) : null
            }
          />
        ))
      )}

      {editable && onAdd ? (
        <Pressable style={styles.add} onPress={onAdd}>
          <Ionicons name="add" size={18} color={colors.primary} />
          <AppText variant="bodyStrong" color={colors.primary}>
            Add cards
          </AppText>
        </Pressable>
      ) : null}

      <View style={styles.total}>
        <AppText variant="bodyStrong">Total</AppText>
        <PriceText cents={side.itemsTotalCents} variant="heading" />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  accepted: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  details: { gap: 1, marginTop: 2 },
  add: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.sm },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
});
