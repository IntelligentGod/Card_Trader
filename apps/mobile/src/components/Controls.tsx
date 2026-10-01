import { forwardRef } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { AppText } from './AppText';

// ───────────── Segmented control ─────────────
interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
}

export function Segmented<T extends string>({ options, value, onChange, testID }: SegmentedProps<T>) {
  return (
    <View testID={testID} style={styles.segmented} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <AppText variant="bodyStrong" color={active ? colors.text : colors.textMuted} style={styles.segmentText}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ───────────── Chips ─────────────
interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  color?: string;
}

export function Chip({ label, selected, onPress, color = colors.primary }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: color, borderColor: color }]}
    >
      <AppText variant="caption" color={selected ? colors.white : colors.text} style={styles.chipText}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  allowNone,
}: {
  options: readonly { value: T; label: string; color?: string }[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  allowNone?: string;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {allowNone ? <Chip label={allowNone} selected={value === undefined} onPress={() => onChange(undefined)} /> : null}
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          color={option.color}
          selected={value === option.value}
          onPress={() => onChange(allowNone && value === option.value ? undefined : option.value)}
        />
      ))}
    </ScrollView>
  );
}

// ───────────── Text field ─────────────
interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField({ label, error, hint, style, ...rest }, ref) {
  return (
    <View style={styles.field}>
      {label ? (
        <AppText variant="label" color={colors.textMuted}>
          {label}
        </AppText>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textSubtle}
        {...rest}
        style={[styles.input, !!error && styles.inputError, rest.multiline && styles.multiline, style]}
      />
      {error ? (
        <AppText variant="caption" color={colors.negative}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color={colors.textSubtle}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

// ───────────── Section header ─────────────
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="heading">{title}</AppText>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <AppText variant="bodyStrong" color={colors.primary}>
            {action}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 3,
  },
  segment: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm + 2, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  segmentText: { fontSize: 13 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: { fontWeight: '600' },
  chipRow: { gap: spacing.sm, paddingVertical: 2 },
  field: { gap: spacing.xs },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  inputError: { borderColor: colors.negative },
  multiline: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
});
