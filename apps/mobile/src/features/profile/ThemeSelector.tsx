import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { makeStyles, radius, spacing, THEME_LABELS, THEME_MODES, themes, useTheme, useThemeMode, type ThemeMode } from '../../theme';

/** Settings → Appearance: one selectable card per theme, each with a small preview of that theme. */
export function ThemeSelector() {
  const styles = useStyles();
  const { mode, setMode } = useThemeMode();

  return (
    <View style={styles.options} accessibilityRole="radiogroup">
      {THEME_MODES.map((option) => (
        <ThemeOption key={option} mode={option} selected={option === mode} onSelect={() => setMode(option)} />
      ))}
    </View>
  );
}

function ThemeOption({ mode, selected, onSelect }: { mode: ThemeMode; selected: boolean; onSelect: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const preview = themes[mode].colors;
  const { title, description } = THEME_LABELS[mode];

  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={title}
      testID={`theme-option-${mode}`}
    >
      {/* A miniature screen drawn with that theme's own colors. */}
      <View style={[styles.preview, { backgroundColor: preview.background, borderColor: preview.border }]} testID="theme-preview">
        <View style={[styles.previewCard, { backgroundColor: preview.surface }]}>
          <View style={[styles.previewLine, { backgroundColor: preview.text, width: '70%' }]} />
          <View style={[styles.previewLine, { backgroundColor: preview.textSubtle, width: '45%' }]} />
        </View>
        <View style={[styles.previewButton, { backgroundColor: preview.primary }]} />
      </View>
      <View style={styles.labelRow}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong">{title}</AppText>
          <AppText variant="caption" color={colors.textMuted} numberOfLines={2}>
            {description}
          </AppText>
        </View>
        <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.primary : colors.textSubtle} />
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  options: { flexDirection: 'row', gap: spacing.md },
  option: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  pressed: { opacity: 0.8 },
  preview: { height: 84, borderRadius: radius.sm, borderWidth: 1, padding: spacing.sm, gap: spacing.sm, justifyContent: 'space-between' },
  previewCard: { borderRadius: 6, padding: 6, gap: 4 },
  previewLine: { height: 5, borderRadius: 3 },
  previewButton: { height: 12, borderRadius: 6, width: '55%', alignSelf: 'flex-end' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: 2 },
  flex: { flex: 1 },
}));
