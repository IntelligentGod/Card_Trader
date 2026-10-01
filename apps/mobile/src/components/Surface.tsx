import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme';

/** White rounded container used for most content blocks. */
export function Surface({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.surface, style]} />;
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow,
  },
});
