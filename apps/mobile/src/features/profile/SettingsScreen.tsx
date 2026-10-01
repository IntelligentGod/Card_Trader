import { StyleSheet, View } from 'react-native';
import { MARKET_VALUE_DISCLAIMER, VALUE_RANGE_LABELS, VALUE_RANGES } from '@card-trader/shared';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Segmented } from '../../components/Controls';
import { Screen } from '../../components/Screen';
import { Surface } from '../../components/Surface';
import { API_URL, APP_VERSION } from '../../config';
import { useSession } from '../../stores/session';
import { useUiPrefs } from '../../stores/uiPrefs';
import { colors, spacing } from '../../theme';
import { signOut } from '../auth/sessionActions';

export function SettingsScreen() {
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
});
