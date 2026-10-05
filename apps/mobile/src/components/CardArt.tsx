import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CardCategory } from '@card-trader/shared';
import { mediaUrl } from '../config';
import { useTheme } from '../theme';
import { AppText } from './AppText';

type IconName = ComponentProps<typeof Ionicons>['name'];

const CATEGORY_ICONS: Record<CardCategory, IconName> = {
  POKEMON: 'flash',
  ONE_PIECE: 'boat',
  SPORTS: 'basketball',
};

interface CardArtProps {
  imageUrl: string | null;
  name: string;
  category: CardCategory;
  width?: number;
  /** Shown on the illustrated face at larger sizes. */
  cardNumber?: string;
  badge?: string | null;
}

/**
 * Card artwork in trading-card proportions (63×88). Without a photo it draws a
 * miniature card face (frame, art window, text lines) instead of text that
 * would be unreadable at thumbnail size.
 */
export function CardArt({ imageUrl, name, category, width = 56, cardNumber, badge }: CardArtProps) {
  const { categoryColors, colors } = useTheme();
  const height = Math.round(width * (88 / 63));
  const palette = categoryColors[category];
  const large = width >= 90;
  const frameRadius = Math.max(4, Math.round(width * 0.08));
  const inset = Math.max(2, Math.round(width * 0.05));

  return (
    <View
      style={[styles.frame, { width, height, borderRadius: frameRadius, backgroundColor: palette.main }]}
      accessibilityLabel={name}
    >
      {imageUrl ? (
        <Image
          source={{ uri: mediaUrl(imageUrl) }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={imageUrl}
          accessibilityLabel={name}
        />
      ) : (
        <View style={[styles.face, { margin: inset, borderRadius: frameRadius - 2, padding: inset, gap: inset, backgroundColor: palette.soft }]}>
          {large ? (
            <AppText variant="caption" color={colors.text} numberOfLines={1} style={styles.name}>
              {name}
            </AppText>
          ) : null}
          <View style={[styles.artWindow, { borderRadius: Math.max(2, frameRadius - 3), borderColor: palette.main }]}>
            <Ionicons name={CATEGORY_ICONS[category]} size={Math.round(width * 0.36)} color={palette.main} />
          </View>
          {large ? (
            <View style={styles.footer}>
              <View style={[styles.textLine, { backgroundColor: palette.main }]} />
              {cardNumber ? (
                <AppText variant="caption" color={colors.textMuted} style={styles.number}>
                  #{cardNumber}
                </AppText>
              ) : null}
            </View>
          ) : (
            <View style={[styles.lines, { gap: Math.max(2, inset - 1) }]}>
              <View style={[styles.textLine, { backgroundColor: palette.main }]} />
              <View style={[styles.textLine, styles.textLineShort, { backgroundColor: palette.main }]} />
            </View>
          )}
        </View>
      )}
      {badge ? (
        <View style={styles.badge}>
          <AppText variant="caption" color={colors.white} style={styles.badgeText}>
            {badge}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  face: { flex: 1 },
  name: { fontWeight: '700' },
  artWindow: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  lines: { paddingBottom: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  textLine: { height: 3, borderRadius: 2, opacity: 0.35, flex: 1 },
  textLineShort: { flex: 0, width: '60%' },
  number: { fontSize: 10, fontWeight: '700' },
  badge: {
    position: 'absolute',
    bottom: 4,
    alignSelf: 'center',
    backgroundColor: 'rgba(14,19,40,0.85)',
    borderRadius: 999,
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
});
