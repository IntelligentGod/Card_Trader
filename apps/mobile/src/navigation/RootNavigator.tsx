import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminAdminsScreen } from '../features/admin/AdminAdminsScreen';
import { AdminAnalyticsScreen } from '../features/admin/AdminAnalyticsScreen';
import { AdminAuditLogScreen } from '../features/admin/AdminAuditLogScreen';
import { AdminBroadcastScreen } from '../features/admin/AdminBroadcastScreen';
import { AdminCardScreen } from '../features/admin/AdminCardScreen';
import { AdminCardsScreen } from '../features/admin/AdminCardsScreen';
import { AdminCreateAdminScreen } from '../features/admin/AdminCreateAdminScreen';
import { AdminEditCardScreen } from '../features/admin/AdminEditCardScreen';
import { AdminEditUserScreen } from '../features/admin/AdminEditUserScreen';
import { AdminHomeScreen } from '../features/admin/AdminHomeScreen';
import { AdminResetPasswordScreen } from '../features/admin/AdminResetPasswordScreen';
import { AdminTradeScreen } from '../features/admin/AdminTradeScreen';
import { AdminTradesScreen } from '../features/admin/AdminTradesScreen';
import { AdminUserScreen } from '../features/admin/AdminUserScreen';
import { ChangePasswordScreen } from '../features/auth/screens/ChangePasswordScreen';
import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { RegisterScreen } from '../features/auth/screens/RegisterScreen';
import { SplashScreen } from '../features/auth/screens/SplashScreen';
import { TwoFactorVerifyScreen } from '../features/auth/screens/TwoFactorVerifyScreen';
import { HelpArticleScreen } from '../features/help/HelpArticleScreen';
import { HelpCenterScreen } from '../features/help/HelpCenterScreen';
import { NotificationHistoryScreen } from '../features/notifications/NotificationHistoryScreen';
import { EnableTwoFactorScreen } from '../features/security/EnableTwoFactorScreen';
import { RecoveryCodesScreen } from '../features/security/RecoveryCodesScreen';
import { SecurityScreen } from '../features/security/SecurityScreen';
import { TwoFactorProofScreen } from '../features/security/TwoFactorProofScreen';
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
import { useTheme } from '../theme';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Auth-gated root. Detail screens live above the tabs so they can be opened
 * from anywhere (home, a scan, a trade) with a single navigate() call.
 */
export function RootNavigator() {
  const { colors } = useTheme();
  const status = useSession((s) => s.status);
  /** an admin reset the password: nothing else is allowed until it's changed */
  const mustChangePassword = useSession((s) => !!s.user?.mustChangePassword);

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
          <Stack.Screen name="TwoFactorVerify" component={TwoFactorVerifyScreen} />
          {/* Help stays reachable signed out (e.g. a blocked account needs Contact Support). */}
          <Stack.Screen name="HelpCenter" component={HelpCenterScreen} options={{ headerShown: true, title: 'Help Center' }} />
          <Stack.Screen name="HelpArticle" component={HelpArticleScreen} options={{ headerShown: true, title: '' }} />
        </Stack.Group>
      ) : mustChangePassword ? (
        <Stack.Screen
          name="ChangePassword"
          component={ChangePasswordScreen}
          options={{ title: 'Choose a new password', headerBackVisible: false, gestureEnabled: false }}
        />
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
          <Stack.Screen name="NotificationHistory" component={NotificationHistoryScreen} options={{ title: 'All notifications' }} />
          <Stack.Screen name="HelpCenter" component={HelpCenterScreen} options={{ title: 'Help Center' }} />
          <Stack.Screen name="HelpArticle" component={HelpArticleScreen} options={{ title: '' }} />
          <Stack.Screen name="EventDetails" component={EventDetailsScreen} options={{ title: '' }} />
          <Stack.Screen name="EventVendors" component={EventVendorsScreen} options={{ title: 'Vendors' }} />
          <Stack.Screen name="EventSearch" component={EventSearchScreen} options={{ title: 'Search this event' }} />
          <Stack.Screen name="EventListing" component={EventListingScreen} options={{ title: '' }} />
          <Stack.Screen name="TradeBuilder" component={TradeBuilderScreen} options={{ title: 'Trade builder' }} />
          <Stack.Screen name="TradeConfirmation" component={TradeConfirmationScreen} options={{ title: 'Trade' }} />
          <Stack.Screen name="TradeHistory" component={TradeHistoryScreen} options={{ title: 'Trade history' }} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit profile' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
          <Stack.Screen name="Security" component={SecurityScreen} options={{ title: 'Security' }} />
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Password' }} />
          <Stack.Screen name="EnableTwoFactor" component={EnableTwoFactorScreen} options={{ title: 'Two-factor authentication' }} />
          <Stack.Screen
            name="RecoveryCodes"
            component={RecoveryCodesScreen}
            options={{ title: 'Recovery codes', headerBackVisible: false, gestureEnabled: false }}
          />
          {/* Reachable only from the admin entry on the profile; the API enforces ADMIN anyway. */}
          <Stack.Screen name="AdminHome" component={AdminHomeScreen} options={{ title: 'Admin' }} />
          <Stack.Screen name="AdminUser" component={AdminUserScreen} options={{ title: 'User' }} />
          <Stack.Screen name="AdminTrades" component={AdminTradesScreen} options={{ title: 'All trades' }} />
          <Stack.Screen name="AdminTrade" component={AdminTradeScreen} options={{ title: 'Trade' }} />
          <Stack.Screen name="AdminCards" component={AdminCardsScreen} options={{ title: 'Card catalog' }} />
          <Stack.Screen name="AdminCard" component={AdminCardScreen} options={{ title: 'Card' }} />
          <Stack.Screen name="AdminAnalytics" component={AdminAnalyticsScreen} options={{ title: 'Analytics' }} />
          <Stack.Screen name="AdminAdmins" component={AdminAdminsScreen} options={{ title: 'Admins' }} />
          <Stack.Screen name="AdminAuditLog" component={AdminAuditLogScreen} options={{ title: 'Audit log' }} />
          <Stack.Group screenOptions={{ presentation: 'modal' }}>
            <Stack.Screen name="AddCard" component={AddCardScreen} options={{ title: 'Add card' }} />
            <Stack.Screen name="SubmitCard" component={SubmitCardScreen} options={{ title: 'Add a missing card' }} />
            <Stack.Screen name="EditCollectionItem" component={EditCollectionItemScreen} options={{ title: 'Edit card' }} />
            <Stack.Screen name="TradeAddCards" component={TradeAddCardsScreen} options={{ title: 'Add cards' }} />
            <Stack.Screen name="ReviewUser" component={ReviewUserScreen} options={{ title: 'Review' }} />
            <Stack.Screen name="EventEdit" component={EventEditScreen} options={{ title: 'Event' }} />
            <Stack.Screen name="EventInventory" component={EventInventoryScreen} options={{ title: 'Bringing to this event' }} />
            <Stack.Screen name="VendorProfileEdit" component={VendorProfileEditScreen} options={{ title: 'Vendor Mode' }} />
            <Stack.Screen name="TwoFactorProof" component={TwoFactorProofScreen} options={{ title: 'Confirm it’s you' }} />
            <Stack.Screen name="AdminEditUser" component={AdminEditUserScreen} options={{ title: 'Edit user' }} />
            <Stack.Screen name="AdminEditCard" component={AdminEditCardScreen} options={{ title: 'Edit card' }} />
            <Stack.Screen name="AdminResetPassword" component={AdminResetPasswordScreen} options={{ title: 'Reset password' }} />
            <Stack.Screen name="AdminCreateAdmin" component={AdminCreateAdminScreen} options={{ title: 'Add admin' }} />
            <Stack.Screen name="AdminBroadcast" component={AdminBroadcastScreen} options={{ title: 'Announcement' }} />
          </Stack.Group>
        </>
      )}
    </Stack.Navigator>
  );
}
