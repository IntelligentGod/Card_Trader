import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { SOCIAL_LINK_KEYS, type SocialLinkKey, type SocialLinks } from '@card-trader/shared';
import { makeStyles, radius, spacing, useTheme } from '../theme';
import { AppText } from './AppText';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const SOCIAL_META: Record<SocialLinkKey, { label: string; icon: IconName; base: string | null }> = {
  instagram: { label: 'Instagram', icon: 'logo-instagram', base: 'https://instagram.com/' },
  x: { label: 'X', icon: 'logo-twitter', base: 'https://x.com/' },
  tiktok: { label: 'TikTok', icon: 'logo-tiktok', base: 'https://tiktok.com/@' },
  youtube: { label: 'YouTube', icon: 'logo-youtube', base: 'https://youtube.com/@' },
  facebook: { label: 'Facebook', icon: 'logo-facebook', base: 'https://facebook.com/' },
  website: { label: 'Website', icon: 'globe-outline', base: null },
};

/** Handles become profile URLs; full links are used as-is. Only http(s) is ever opened. */
export function socialUrl(key: SocialLinkKey, value: string): string | null {
  if (/^https?:\/\//i.test(value)) return value;
  const base = SOCIAL_META[key].base;
  return base ? base + value.replace(/^@/, '') : null;
}

export function SocialLinksRow({ links, website }: { links: SocialLinks; website?: string | null }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const entries = SOCIAL_LINK_KEYS.flatMap((key) => {
    const value = key === 'website' ? (website ?? links.website) : links[key];
    const url = value ? socialUrl(key, value) : null;
    return url ? [{ key, url }] : [];
  });
  if (entries.length === 0) return null;
  return (
    <View style={styles.row}>
      {entries.map(({ key, url }) => (
        <Pressable
          key={key}
          style={styles.chip}
          onPress={() => void Linking.openURL(url)}
          accessibilityRole="link"
          accessibilityLabel={SOCIAL_META[key].label}
        >
          <Ionicons name={SOCIAL_META[key].icon} size={16} color={colors.primary} />
          <AppText variant="caption" color={colors.primary}>
            {SOCIAL_META[key].label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
}));
