import { Alert, Linking, Platform, Share } from 'react-native';
import { APP_VERSION } from '../../config';
import { useSession } from '../../stores/session';

export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@cardtrader.app';
export const SUPPORT_SUBJECT = 'Card Trader support';

export interface SupportContext {
  version: string;
  platform: string;
  /** the signed-in user's public code, if any */
  publicId?: string | null;
}

/** mailto: link with the details that help support find the account (never secrets). */
export function supportMailto(context: SupportContext, email = SUPPORT_EMAIL): string {
  const body = [
    'Describe what happened:',
    '',
    '',
    '---',
    `App version: ${context.version}`,
    `Platform: ${context.platform}`,
    context.publicId ? `Public code: ${context.publicId}` : null,
  ]
    .filter((line) => line !== null)
    .join('\n');
  return `mailto:${email}?subject=${encodeURIComponent(SUPPORT_SUBJECT)}&body=${encodeURIComponent(body)}`;
}

/** Opens the mail app; without one, shows the address with a way to copy/share it. */
export async function contactSupport(): Promise<void> {
  const url = supportMailto({
    version: APP_VERSION,
    platform: `${Platform.OS} ${String(Platform.Version)}`,
    publicId: useSession.getState().user?.publicId,
  });
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('No email app found', `Write to us at ${SUPPORT_EMAIL}.`, [
      { text: 'Copy / share address', onPress: () => void Share.share({ message: SUPPORT_EMAIL }) },
      { text: 'OK', style: 'cancel' },
    ]);
  }
}
