import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isValidPublicId } from '@card-trader/shared';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Controls';
import { ScreenBackground } from '../../components/ScreenBackground';
import type { RootScreenProps } from '../../navigation/types';
import { useSession } from '../../stores/session';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { interpretScan } from './scan';

export function QrScannerScreen({ navigation }: RootScreenProps<'QrScanner'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const focused = useIsFocused();
  const ownPublicId = useSession((s) => s.user?.publicId);
  const locked = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  // Re-arm the scanner every time the screen comes back into focus.
  useFocusEffect(
    useCallback(() => {
      locked.current = false;
      setMessage(null);
    }, []),
  );

  const openProfile = (publicId: string) => {
    locked.current = true;
    navigation.navigate('OtherUserProfile', { publicId });
  };

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (locked.current) return;
    const outcome = interpretScan(data, ownPublicId);
    if (outcome.kind === 'user') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      openProfile(outcome.publicId);
      return;
    }
    locked.current = true;
    setMessage(outcome.kind === 'self' ? 'That’s your own code 🙂' : 'That isn’t a Card Trader code');
    setTimeout(() => {
      locked.current = false;
      setMessage(null);
    }, 2000);
  };

  if (!permission) return <View style={styles.dark} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permission}>
        <ScreenBackground />
        <AppText variant="title" align="center">
          Scan to trade
        </AppText>
        <AppText color={colors.textMuted} align="center">
          Allow camera access to scan another collector’s QR code. The code only contains their public profile link.
        </AppText>
        {permission.canAskAgain ? (
          <Button title="Allow camera" icon="camera" onPress={() => void requestPermission()} />
        ) : (
          <AppText color={colors.negative} align="center">
            Camera access is off. Enable it in your phone’s settings.
          </AppText>
        )}
        <ManualEntry value={manualCode} onChange={setManualCode} onSubmit={openProfile} />
        <Button title="Show my QR instead" variant="ghost" onPress={() => navigation.navigate('MyQrCode')} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.dark}>
      {focused ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onScanned}
        />
      ) : null}
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <AppText variant="heading" color={colors.white} align="center">
          Scan a collector’s QR code
        </AppText>
        <View style={styles.frame} />
        {message ? (
          <View style={styles.toast}>
            <AppText color={colors.white}>{message}</AppText>
          </View>
        ) : (
          <View style={styles.toastPlaceholder} />
        )}
        <Button title="Show my QR" icon="qr-code" variant="secondary" onPress={() => navigation.navigate('MyQrCode')} />
      </SafeAreaView>
    </View>
  );
}

function ManualEntry({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: (id: string) => void }) {
  const styles = useStyles();
  const trimmed = value.trim();
  return (
    <View style={styles.manual}>
      <TextField label="Or enter their code" placeholder="e.g. a1B2c3D4e5F6" value={value} onChangeText={onChange} autoCapitalize="none" autoCorrect={false} />
      <Button title="Open profile" variant="secondary" disabled={!isValidPublicId(trimmed)} onPress={() => onSubmit(trimmed)} />
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  dark: { flex: 1, backgroundColor: colors.black },
  overlay: { flex: 1, justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl },
  frame: { width: 250, height: 250, borderRadius: radius.lg, borderWidth: 3, borderColor: colors.white },
  toast: { backgroundColor: colors.overlay, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  toastPlaceholder: { height: 36 },
  permission: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg, backgroundColor: colors.background },
  manual: { gap: spacing.sm },
}));
