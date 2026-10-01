import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { EventSearchResult } from '@card-trader/shared';

/** The five main tabs: Discover | Inventory | Trade | Events | Profile. */
export type MainTabParamList = {
  Discover: undefined;
  Inventory: undefined;
  Trade: undefined;
  Events: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  /** second sign-in step for accounts with 2FA (no session yet) */
  TwoFactorVerify: { challengeToken: string; expiresIn: number };
  /** shown once right after sign-up */
  VerifyEmail: undefined;
  /** forced (admin reset) when user.mustChangePassword, otherwise from Security */
  ChangePassword: undefined;
  Security: undefined;
  EnableTwoFactor: undefined;
  /** shown once; leaving needs "I saved these codes" */
  RecoveryCodes: { codes: string[] };
  /** code or recovery code before turning 2FA off / replacing recovery codes */
  TwoFactorProof: { purpose: 'disable' | 'regenerate' };
  NotificationHistory: undefined;
  HelpCenter: undefined;
  HelpArticle: { articleId: string };
  Main: NavigatorScreenParams<MainTabParamList>;
  AddCard: undefined;
  SubmitCard: undefined;
  EditCollectionItem: { itemId: string };
  CardDetails: { itemId: string };
  CardPriceChart: { itemId: string };
  CollectionAnalytics: undefined;
  MyQrCode: undefined;
  /** eventId: opened from a card show, so a trade started here is linked to it */
  OtherUserProfile: { publicId: string; eventId?: string };
  OtherUserCollection: { publicId: string; eventId?: string };
  QrScanner: undefined;
  Notifications: undefined;
  VendorProfileEdit: undefined;
  EventDetails: { eventId: string };
  /** no eventId = create a new event */
  EventEdit: { eventId?: string };
  EventVendors: { eventId: string };
  EventInventory: { eventId: string };
  EventSearch: { eventId: string };
  /** a card found through Search This Event */
  EventListing: { eventId: string; result: EventSearchResult };
  TradeBuilder: { tradeId: string };
  TradeAddCards: { tradeId: string; side: 'mine' | 'theirs'; publicId: string };
  TradeConfirmation: { tradeId: string };
  TradeHistory: undefined;
  ReviewUser: { tradeId: string; displayName: string };
  EditProfile: undefined;
  Settings: undefined;
  /** read-only admin console (role ADMIN only) */
  AdminHome: undefined;
  AdminUser: { publicId: string };
  AdminTrades: undefined;
  AdminTrade: { tradeId: string };
  AdminEditUser: { publicId: string };
  AdminCards: undefined;
  AdminCard: { cardId: string };
  AdminEditCard: { cardId: string };
  AdminAnalytics: undefined;
  AdminResetPassword: { publicId: string };
  /** SUPER_ADMIN only */
  AdminAdmins: undefined;
  AdminCreateAdmin: undefined;
  AdminAuditLog: undefined;
  AdminBroadcast: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
