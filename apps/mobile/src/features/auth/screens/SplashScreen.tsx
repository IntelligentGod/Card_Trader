import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';
import { AppText } from '../../../components/AppText';
import { makeStyles, spacing, useTheme } from '../../../theme';

export function SplashScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Ionicons name="swap-horizontal" size={44} color={colors.onPrimary} />
      </View>
      <AppText variant="title" color={colors.onPrimary}>
        Card Trader
      </AppText>
      <ActivityIndicator color={colors.onPrimary} style={{ marginTop: spacing.xl }} />
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, gap: spacing.md },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
