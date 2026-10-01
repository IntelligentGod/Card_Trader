import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { MARKET_VALUE_DISCLAIMER, VALUE_RANGE_LABELS, VALUE_RANGES } from '@card-trader/shared';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Segmented } from '../../components/Controls';
import { Screen } from '../../components/Screen';
import { Surface } from '../../components/Surface';
import { API_URL, APP_VERSION } from '../../config';
import type { RootScreenProps } from '../../navigation/types';
import { useSession } from '../../stores/session';
import { useUiPrefs } from '../../stores/uiPrefs';
import { colors, spacing } from '../../theme';
import { signOut } from '../auth/sessionActions';

export function SettingsScreen({ navigation }: RootScreenProps<'Settings'>) {
  const user = useSession((s) => s.user);
  const offline = useSession((s) => s.offline);
  const range = useUiPrefs((s) => s.chartRange);
  const setRange = useUiPrefs((s) => s.setChartRange);

  return (
    <Screen>
      <Surface style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          Account
        </AppText>
        <Row label="Email" value={user?.email ?? ''} />
        <Row label="Public code" value={user?.publicId ?? ''} />
        <LinkRow
          icon="shield-checkmark-outline"
          label="Security"
          detail={user?.twoFactorEnabled ? '2FA on' : undefined}
          testID="settings-security"
          onPress={() => navigation.navigate('Security')}
        />
        <LinkRow icon="help-circle-outline" label="Help Center" onPress={() => navigation.navigate('HelpCenter')} />
      </Surface>

      <Surface style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          Default chart range
        </AppText>
        <Segmented options={VALUE_RANGES.map((r) => ({ value: r, label: VALUE_RANGE_LABELS[r] }))} value={range} onChange={setRange} />
      </Surface>

      <Surface style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          About prices
        </AppText>
        <AppText color={colors.textMuted}>
          {MARKET_VALUE_DISCLAIMER} Estimates use the median of the three most recent sales of the same card in the same condition or grade.
          Raw cards are never compared with graded cards.
        </AppText>
      </Surface>

      <Surface style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          App
        </AppText>
        <Row label="Version" value={APP_VERSION} />
        <Row label="Server" value={API_URL} />
        <Row label="Connection" value={offline ? 'Offline (cached profile)' : 'Online'} />
      </Surface>

      <Button title="Sign out" variant="danger" icon="log-out-outline" onPress={() => void signOut()} />
    </Screen>
  );
}

function LinkRow({
  icon,
  label,
  detail,
  onPress,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]} accessibilityRole="button" testID={testID}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <AppText variant="bodyStrong" style={styles.flex}>
        {label}
      </AppText>
      {detail ? (
        <AppText variant="caption" color={colors.textMuted}>
          {detail}
        </AppText>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText color={colors.textMuted}>{label}</AppText>
      <AppText variant="bodyStrong" style={styles.value} numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg },
  value: { flexShrink: 1, textAlign: 'right' },
  flex: { flex: 1 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
});
