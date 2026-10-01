import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from './src/api/queryClient';
import { useRefreshMeOnForeground } from './src/features/auth/hooks';
import { bootstrapSession } from './src/features/auth/sessionActions';
import { NotificationBanner } from './src/features/notifications/NotificationBanner';
import { navigationRef, useProfileDeepLinks } from './src/navigation/deepLinks';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme';

const navigationTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.primary, card: colors.surface, text: colors.text },
};

export default function App() {
  const [navigationReady, setNavigationReady] = useState(false);
  useProfileDeepLinks(navigationReady);
  useRefreshMeOnForeground();

  useEffect(() => {
    void bootstrapSession();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer ref={navigationRef} theme={navigationTheme} onReady={() => setNavigationReady(true)}>
          <StatusBar style="dark" />
          <RootNavigator />
          {/* In-app banners for new notifications; overlays everything but passes touches through. */}
          <NotificationBanner />
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
