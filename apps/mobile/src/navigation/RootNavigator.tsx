import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { RegisterScreen } from '../features/auth/screens/RegisterScreen';
import { SplashScreen } from '../features/auth/screens/SplashScreen';
import { AddCardScreen } from '../features/collection/screens/AddCardScreen';
import { CardDetailsScreen } from '../features/collection/screens/CardDetailsScreen';
import { CardPriceChartScreen } from '../features/collection/screens/CardPriceChartScreen';
import { EditCollectionItemScreen } from '../features/collection/screens/EditCollectionItemScreen';
import { SubmitCardScreen } from '../features/collection/screens/SubmitCardScreen';
import { EventDetailsScreen } from '../features/events/screens/EventDetailsScreen';
import { EventEditScreen } from '../features/events/screens/EventEditScreen';
import { EventInventoryScreen } from '../features/events/screens/EventInventoryScreen';
import { EventListingScreen } from '../features/events/screens/EventListingScreen';
import { EventSearchScreen } from '../features/events/screens/EventSearchScreen';
import { EventVendorsScreen } from '../features/events/screens/EventVendorsScreen';
import { NotificationsScreen } from '../features/notifications/NotificationsScreen';
import { CollectionAnalyticsScreen } from '../features/portfolio/CollectionAnalyticsScreen';
import { EditProfileScreen } from '../features/profile/EditProfileScreen';
import { SettingsScreen } from '../features/profile/SettingsScreen';
import { VendorProfileEditScreen } from '../features/profile/VendorProfileEditScreen';
import { MyQrCodeScreen } from '../features/qr/MyQrCodeScreen';
import { QrScannerScreen } from '../features/qr/QrScannerScreen';
import { ReviewUserScreen } from '../features/reviews/ReviewUserScreen';
import { TradeAddCardsScreen } from '../features/trades/screens/TradeAddCardsScreen';
import { TradeBuilderScreen } from '../features/trades/screens/TradeBuilderScreen';
import { TradeConfirmationScreen } from '../features/trades/screens/TradeConfirmationScreen';
import { TradeHistoryScreen } from '../features/trades/screens/TradeListScreens';
import { OtherUserCollectionScreen } from '../features/users/OtherUserCollectionScreen';
import { OtherUserProfileScreen } from '../features/users/OtherUserProfileScreen';
import { useSession } from '../stores/session';
import { colors } from '../theme';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Auth-gated root. Detail screens live above the tabs so they can be opened
 * from anywhere (home, a scan, a trade) with a single navigate() call.
 */
export function RootNavigator() {
  const status = useSession((s) => s.status);

  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {status === 'booting' ? (
        <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
      ) : status === 'signedOut' ? (
        <Stack.Group screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Group>
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="CardDetails" component={CardDetailsScreen} options={{ title: '' }} />
          <Stack.Screen name="CardPriceChart" component={CardPriceChartScreen} options={{ title: 'Price history' }} />
          <Stack.Screen name="CollectionAnalytics" component={CollectionAnalyticsScreen} options={{ title: 'Collection analytics' }} />
          <Stack.Screen name="MyQrCode" component={MyQrCodeScreen} options={{ title: 'My QR code' }} />
          <Stack.Screen name="OtherUserProfile" component={OtherUserProfileScreen} options={{ title: 'Collector' }} />
          <Stack.Screen name="OtherUserCollection" component={OtherUserCollectionScreen} options={{ title: 'Available cards' }} />
          <Stack.Screen name="QrScanner" component={QrScannerScreen} options={{ title: 'Scan QR' }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
          <Stack.Screen name="EventDetails" component={EventDetailsScreen} options={{ title: '' }} />
          <Stack.Screen name="EventVendors" component={EventVendorsScreen} options={{ title: 'Vendors' }} />
          <Stack.Screen name="EventSearch" component={EventSearchScreen} options={{ title: 'Search this event' }} />
          <Stack.Screen name="EventListing" component={EventListingScreen} options={{ title: '' }} />
          <Stack.Screen name="TradeBuilder" component={TradeBuilderScreen} options={{ title: 'Trade builder' }} />
          <Stack.Screen name="TradeConfirmation" component={TradeConfirmationScreen} options={{ title: 'Trade' }} />
          <Stack.Screen name="TradeHistory" component={TradeHistoryScreen} options={{ title: 'Trade history' }} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit profile' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
          <Stack.Group screenOptions={{ presentation: 'modal' }}>
            <Stack.Screen name="AddCard" component={AddCardScreen} options={{ title: 'Add card' }} />
            <Stack.Screen name="SubmitCard" component={SubmitCardScreen} options={{ title: 'Add a missing card' }} />
            <Stack.Screen name="EditCollectionItem" component={EditCollectionItemScreen} options={{ title: 'Edit card' }} />
            <Stack.Screen name="TradeAddCards" component={TradeAddCardsScreen} options={{ title: 'Add cards' }} />
            <Stack.Screen name="ReviewUser" component={ReviewUserScreen} options={{ title: 'Review' }} />
            <Stack.Screen name="EventEdit" component={EventEditScreen} options={{ title: 'Event' }} />
            <Stack.Screen name="EventInventory" component={EventInventoryScreen} options={{ title: 'Bringing to this event' }} />
            <Stack.Screen name="VendorProfileEdit" component={VendorProfileEditScreen} options={{ title: 'Vendor Mode' }} />
          </Stack.Group>
        </>
      )}
    </Stack.Navigator>
  );
}
