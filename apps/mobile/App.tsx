import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from './src/api/queryClient';
import { useRefreshMeOnForeground } from './src/features/auth/hooks';
import { bootstrapSession } from './src/features/auth/sessionActions';
import { NotificationBanner } from './src/features/notifications/NotificationBanner';
import { navigationRef, useProfileDeepLinks } from './src/navigation/deepLinks';
import { RootNavigator } from './src/navigation/RootNavigator';
import { hydrateThemeMode, useTheme, useThemeMode, type AppTheme } from './src/theme';

/** React Navigation's own colors (screen backgrounds, headers, borders) follow the app theme. */
function navigationThemeFor({ dark, colors }: AppTheme): Theme {
  const base = dark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.negative,
    },
  };
}

export default function App() {
  const [navigationReady, setNavigationReady] = useState(false);
  useProfileDeepLinks(navigationReady);
  useRefreshMeOnForeground();
  const theme = useTheme();
  const { hydrated: themeReady } = useThemeMode();
  const navigationTheme = useMemo(() => navigationThemeFor(theme), [theme]);

  useEffect(() => {
    void hydrateThemeMode();
    void bootstrapSession();
  }, []);

  // The saved theme loads in a few milliseconds; waiting avoids a flash of the wrong theme.
  if (!themeReady) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer ref={navigationRef} theme={navigationTheme} onReady={() => setNavigationReady(true)}>
          <StatusBar style={theme.dark ? 'light' : 'dark'} />
          <RootNavigator />
          {/* In-app banners for new notifications; overlays everything but passes touches through. */}
          <NotificationBanner />
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
