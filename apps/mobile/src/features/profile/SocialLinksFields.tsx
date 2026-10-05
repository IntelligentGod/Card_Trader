import { StyleSheet, View } from 'react-native';
import type { SocialLinkKey, SocialLinks } from '@card-trader/shared';
import { AppText } from '../../components/AppText';
import { TextField } from '../../components/Controls';
import { SOCIAL_META } from '../../components/Social';
import { spacing, useTheme } from '../../theme';

const LINK = /^(@?[\w.-]{1,60}|https?:\/\/\S{3,190})$/i;

/** Mirrors the API rule: a handle or a full http(s) link. Empty = not set. Exported for tests. */
export function socialLinkErrors(links: SocialLinks): Partial<Record<SocialLinkKey, string>> {
  const errors: Partial<Record<SocialLinkKey, string>> = {};
  for (const [key, value] of Object.entries(links) as [SocialLinkKey, string | undefined][]) {
    const v = value?.trim() ?? '';
    if (v && !LINK.test(v)) errors[key] = key === 'website' ? 'Use a full link, e.g. https://…' : 'Use @handle or a full link';
    if (v && key === 'website' && !/^https?:\/\//i.test(v)) errors[key] = 'Use a full link, e.g. https://…';
  }
  return errors;
}

/** Drops empty values so clearing a field removes the link. */
export function cleanSocialLinks(links: SocialLinks): SocialLinks {
  const out: SocialLinks = {};
  for (const [key, value] of Object.entries(links) as [SocialLinkKey, string | undefined][]) {
    if (value?.trim()) out[key] = value.trim();
  }
  return out;
}

export function SocialLinksFields({
  value,
  onChange,
  keys,
  errors = {},
}: {
  value: SocialLinks;
  onChange: (next: SocialLinks) => void;
  keys: SocialLinkKey[];
  errors?: Partial<Record<SocialLinkKey, string>>;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <AppText variant="label" color={colors.textMuted}>
        Social links
      </AppText>
      {keys.map((key) => (
        <TextField
          key={key}
          label={SOCIAL_META[key].label}
          placeholder={key === 'website' ? 'https://…' : '@handle'}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={key === 'website' ? 'url' : 'default'}
          value={value[key] ?? ''}
          onChangeText={(text) => onChange({ ...value, [key]: text })}
          maxLength={200}
          error={errors[key]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
});
