// Icon fonts load asynchronously; render a plain placeholder in tests.
jest.mock('@expo/vector-icons', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const Icon = ({ name }: { name: string }) => <Text>{name}</Text>;
  Icon.glyphMap = {};
  return { Ionicons: Icon };
});

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

// The store SDK is native; tests see a store with nothing on offer and no purchases.
jest.mock('react-native-purchases', () => {
  const customerInfo = { entitlements: { active: {}, all: {} } };
  const Purchases = {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    logIn: jest.fn(async () => ({ customerInfo, created: false })),
    logOut: jest.fn(async () => customerInfo),
    getOfferings: jest.fn(async () => ({ current: null, all: {} })),
    purchasePackage: jest.fn(async () => ({ customerInfo })),
    restorePurchases: jest.fn(async () => customerInfo),
    getCustomerInfo: jest.fn(async () => customerInfo),
  };
  return { __esModule: true, default: Purchases, LOG_LEVEL: { ERROR: 'ERROR', WARN: 'WARN' } };
});
