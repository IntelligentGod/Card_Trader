import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { MARKET_VALUE_DISCLAIMER } from '@card-trader/shared';
import { makeStyles, spacing, useTheme } from '../theme';
import { AppText } from './AppText';
import { ScreenBackground } from './ScreenBackground';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
}

/** Standard screen shell: safe area, background, optional scroll + pull-to-refresh, sticky footer. */
export function Screen({ children, scroll = true, refreshing = false, onRefresh, edges = [], contentStyle, footer }: ScreenProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} style={styles.safe}>
      <ScreenBackground />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, contentStyle]}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Disclaimer({ text = MARKET_VALUE_DISCLAIMER }: { text?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <AppText variant="caption" color={colors.textSubtle} align="center" style={styles.disclaimer}>
      {text}
    </AppText>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  disclaimer: { paddingHorizontal: spacing.lg },
}));
