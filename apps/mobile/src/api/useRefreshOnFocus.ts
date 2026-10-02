import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

/**
 * Tab screens stay mounted, so returning to one never refetches by itself: changes made on
 * another screen, by the other trader or by the nightly price update would stay invisible.
 * Refreshes `keys` every time the screen regains focus (the first focus already fetched).
 */
export function useRefreshOnFocus(keys: readonly QueryKey[]): void {
  const client = useQueryClient();
  const latestKeys = useRef(keys);
  latestKeys.current = keys;
  const firstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      for (const queryKey of latestKeys.current) void client.invalidateQueries({ queryKey });
    }, [client]),
  );
}
