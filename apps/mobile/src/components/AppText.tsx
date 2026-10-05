import { Text, type TextProps, type TextStyle } from 'react-native';
import { typography, useTheme } from '../theme';

export type TextVariant = keyof typeof typography;

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
}

/** Themed text; `color` defaults to the theme's primary text color. */
export function AppText({ variant = 'body', color, align, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  return <Text {...rest} style={[typography[variant] as TextStyle, { color: color ?? colors.text, textAlign: align }, style]} />;
}
