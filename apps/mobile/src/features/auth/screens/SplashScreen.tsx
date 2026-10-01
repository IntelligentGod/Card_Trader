import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from '../../../components/AppText';
import { colors, spacing } from '../../../theme';

export function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Ionicons name="swap-horizontal" size={44} color={colors.white} />
      </View>
      <AppText variant="title" color={colors.white}>
        Card Trader
      </AppText>
      <ActivityIndicator color={colors.white} style={{ marginTop: spacing.xl }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, gap: spacing.md },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
