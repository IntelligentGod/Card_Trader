import { View, type ViewProps } from 'react-native';
import { makeStyles, radius, spacing } from '../theme';

/** White rounded container used for most content blocks. */
export function Surface({ style, ...rest }: ViewProps) {
  const styles = useStyles();
  return <View {...rest} style={[styles.surface, style]} />;
}

const useStyles = makeStyles(({ colors, shadow }) => ({
  surface: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow,
  },
}));
