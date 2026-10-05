import { memo, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import type { CardCategory } from '@card-trader/shared';
import { makeStyles, radius, spacing, useTheme } from '../theme';
import { AppText } from './AppText';
import { CardArt } from './CardArt';
import { PriceText } from './PriceText';

export interface CardRowProps {
  name: string;
  subtitle: string;
  tierLabel: string;
  category: CardCategory;
  imageUrl: string | null;
  valueCents: number | null;
  quantity?: number;
  trailing?: ReactNode;
  footer?: ReactNode;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}

/** One card in a list: artwork, identity, grade/condition, and value. */
export const CardRow = memo(function CardRow({
  name,
  subtitle,
  tierLabel,
  category,
  imageUrl,
  valueCents,
  quantity,
  trailing,
  footer,
  selected,
  onPress,
  testID,
}: CardRowProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, selected && styles.selected, pressed && styles.pressed]}
    >
      <CardArt imageUrl={imageUrl} name={name} category={category} width={48} />
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
          {subtitle}
        </AppText>
        <View style={styles.tags}>
          <View style={styles.tag}>
            <AppText variant="caption" color={colors.primary} style={styles.tagText}>
              {tierLabel}
            </AppText>
          </View>
          {quantity && quantity > 1 ? (
            <AppText variant="caption" color={colors.textMuted}>
              ×{quantity}
            </AppText>
          ) : null}
        </View>
        {footer}
      </View>
      <View style={styles.trailing}>
        <PriceText cents={valueCents} />
        {trailing}
      </View>
    </Pressable>
  );
});

const useStyles = makeStyles(({ colors }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  pressed: { opacity: 0.85 },
  body: { flex: 1, gap: 2 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  tag: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 1 },
  tagText: { fontWeight: '600' },
  trailing: { alignItems: 'flex-end', gap: spacing.xs },
}));
