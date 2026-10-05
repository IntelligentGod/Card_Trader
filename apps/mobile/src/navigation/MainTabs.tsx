import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MyCollectionScreen } from '../features/collection/screens/MyCollectionScreen';
import { EventsScreen } from '../features/events/screens/EventsScreen';
import { DiscoverScreen } from '../features/home/DiscoverScreen';
import { MyProfileScreen } from '../features/profile/MyProfileScreen';
import { useNotificationAlerts } from '../features/notifications/phoneAlerts';
import { ActiveTradesScreen } from '../features/trades/screens/TradeListScreens';
import { useTheme } from '../theme';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Discover: ['compass', 'compass-outline'],
  Inventory: ['albums', 'albums-outline'],
  Trade: ['swap-horizontal', 'swap-horizontal-outline'],
  Events: ['calendar', 'calendar-outline'],
  Profile: ['person-circle', 'person-circle-outline'],
};

/** Discover | Inventory | Trade | Events | Profile */
export function MainTabs() {
  const { colors } = useTheme();
  useNotificationAlerts();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = ICONS[route.name];
          return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Inventory" component={MyCollectionScreen} />
      <Tab.Screen name="Trade" component={ActiveTradesScreen} />
      <Tab.Screen name="Events" component={EventsScreen} />
      <Tab.Screen name="Profile" component={MyProfileScreen} />
    </Tab.Navigator>
  );
}
