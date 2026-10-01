import { createNavigationContainerRef } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { parseUserDeepLink } from '@card-trader/shared';
import { useSession } from '../stores/session';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Handles cardtrader://u/{publicId} links (e.g. a QR scanned with the phone's
 * own camera). Parsing is strict; anything else is ignored. Links received
 * while signed out are held until sign-in completes.
 */
export function useProfileDeepLinks(navigationReady: boolean): void {
  const status = useSession((s) => s.status);
  const pending = useSession((s) => s.pendingPublicId);
  const setPending = useSession((s) => s.setPendingPublicId);

  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url) return;
      const publicId = parseUserDeepLink(url);
      if (publicId) setPending(publicId);
    };
    void Linking.getInitialURL().then(handle);
    const subscription = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => subscription.remove();
  }, [setPending]);

  useEffect(() => {
    if (!pending || status !== 'signedIn' || !navigationReady || !navigationRef.isReady()) return;
    const own = useSession.getState().user?.publicId;
    setPending(null);
    if (pending !== own) navigationRef.navigate('OtherUserProfile', { publicId: pending });
  }, [pending, status, navigationReady, setPending]);
}
