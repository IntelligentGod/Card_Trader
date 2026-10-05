import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { errorMessage } from '../api/client';
import { makeStyles, spacing, useTheme } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionTitle?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'albums-outline', title, message, actionTitle, onAction }: EmptyStateProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View testID="empty-state" style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      <AppText variant="heading" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText color={colors.textMuted} align="center">
          {message}
        </AppText>
      ) : null}
      {actionTitle && onAction ? <Button title={actionTitle} onPress={onAction} style={styles.action} /> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View testID="error-state" style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: colors.negativeSoft }]}>
        <Ionicons name="cloud-offline-outline" size={30} color={colors.negative} />
      </View>
      <AppText variant="heading" align="center">
        Couldn’t load this
      </AppText>
      <AppText color={colors.textMuted} align="center">
        {errorMessage(error)}
      </AppText>
      {onRetry ? <Button title="Try again" variant="secondary" icon="refresh" onPress={onRetry} style={styles.action} /> : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: { alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.sm },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.sm,
  },
  action: { marginTop: spacing.md, alignSelf: 'stretch' },
}));
