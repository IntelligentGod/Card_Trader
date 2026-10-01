import { Ionicons } from '@expo/vector-icons';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { Surface } from '../../components/Surface';
import type { RootScreenProps } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme';
import { recoveryCodesText } from '../auth/twoFactor';

/** The 10 recovery codes, shown once (the server keeps only hashes). Leaving needs an explicit confirmation. */
export function RecoveryCodesScreen({ route, navigation }: RootScreenProps<'RecoveryCodes'>) {
  const { codes } = route.params;

  return (
    <Screen
      footer={
        <>
          <Button title="Share or save codes" icon="share-outline" variant="secondary" onPress={() => void Share.share({ message: recoveryCodesText(codes) })} />
          <Button title="I saved these codes" testID="recovery-codes-done" onPress={() => navigation.goBack()} />
        </>
      }
    >
      <View style={styles.notice}>
        <Ionicons name="warning" size={20} color={colors.warning} />
        <AppText style={styles.flex}>
          Save these codes somewhere safe, like a password manager. You won’t see them again. If you lose your phone, each code
          signs you in once instead of an authenticator code.
        </AppText>
      </View>
      <Surface style={styles.grid} testID="recovery-codes">
        {codes.map((code, index) => (
          <View key={code} style={styles.cell}>
            <AppText variant="caption" color={colors.textSubtle} style={styles.index}>
              {index + 1}.
            </AppText>
            <AppText variant="bodyStrong" selectable style={styles.code}>
              {code}
            </AppText>
          </View>
        ))}
      </Surface>
      <AppText variant="caption" color={colors.textMuted}>
        Getting new codes later (Settings → Security) makes these ones stop working.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  cell: { width: '50%', flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  index: { width: 22, textAlign: 'right' },
  code: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
});
