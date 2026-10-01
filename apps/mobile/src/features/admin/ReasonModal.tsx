import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Controls';
import { colors, radius, spacing } from '../../theme';
import { REASON_MAX } from './adminForm';

interface ReasonModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmTitle: string;
  destructive?: boolean;
  loading?: boolean;
  error?: unknown;
  onConfirm: (reason: string | null) => void;
  onClose: () => void;
}

/**
 * Cross-platform confirm with an optional audit reason (Alert.prompt is iOS-only).
 * The reason is cleared every time the dialog opens.
 */
export function ReasonModal({ visible, title, message, confirmTitle, destructive, loading, error, onConfirm, onClose }: ReasonModalProps) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (visible) setReason('');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={loading ? undefined : onClose} accessibilityLabel="Close" />
        <View style={styles.sheet} accessibilityViewIsModal>
          <AppText variant="heading">{title}</AppText>
          <AppText color={colors.textMuted}>{message}</AppText>
          <TextField
            label="Reason (saved in the audit log)"
            placeholder="Optional"
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={REASON_MAX}
            testID="reason-input"
          />
          {error ? <AppText color={colors.negative}>{errorMessage(error)}</AppText> : null}
          <View style={styles.row}>
            <Button title="Cancel" variant="secondary" compact style={styles.flex} onPress={onClose} disabled={loading} />
            <Button
              title={confirmTitle}
              variant={destructive ? 'danger' : 'primary'}
              compact
              style={styles.flex}
              loading={loading}
              onPress={() => onConfirm(reason.trim() || null)}
              testID="reason-confirm"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
