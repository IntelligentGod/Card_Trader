import { formatCents } from '@card-trader/shared';
import { colors } from '../theme';
import { AppText, type TextVariant } from './AppText';

interface PriceTextProps {
  cents: number | null | undefined;
  variant?: TextVariant;
  color?: string;
  /** Shown when there is no estimate yet. */
  placeholder?: string;
  testID?: string;
}

export function PriceText({ cents, variant = 'bodyStrong', color = colors.text, placeholder = 'No estimate', testID }: PriceTextProps) {
  if (cents === null || cents === undefined) {
    return (
      <AppText testID={testID} variant={variant === 'display' || variant === 'title' ? 'heading' : 'caption'} color={colors.textSubtle}>
        {placeholder}
      </AppText>
    );
  }
  return (
    <AppText testID={testID} variant={variant} color={color}>
      {formatCents(cents)}
    </AppText>
  );
}
