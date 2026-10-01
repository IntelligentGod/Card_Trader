import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, typography } from '../theme';

export type TextVariant = keyof typeof typography;

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
}

export function AppText({ variant = 'body', color = colors.text, align, style, ...rest }: AppTextProps) {
  return <Text {...rest} style={[typography[variant] as TextStyle, { color, textAlign: align }, style]} />;
}
