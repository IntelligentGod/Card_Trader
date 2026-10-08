import { tmpdir } from 'os';
import { join } from 'path';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://cardtrader:cardtrader@localhost:5433/cardtrader_test?schema=public';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.JWT_ACCESS_SECRET = 'test-secret-that-is-definitely-longer-than-32-characters';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
process.env.STORAGE_LOCAL_DIR = join(tmpdir(), 'card-trader-test-uploads');
process.env.SWAGGER_ENABLED = 'false';
process.env.PRICING_PROVIDERS = 'MOCK';
process.env.TWO_FACTOR_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64');
process.env.GOOGLE_CLIENT_IDS = 'test-google-client.apps.googleusercontent.com';
process.env.APPLE_CLIENT_IDS = 'com.cardtrader.app';
// The paywall is on in tests (registerUser unlocks accounts); the store itself is not configured.
process.env.PAYWALL_ENABLED = 'true';
process.env.REVENUECAT_SECRET_KEY = '';
process.env.REVENUECAT_WEBHOOK_SECRET = 'test-webhook-secret';
// Empty (not deleted) so apps/api/.env cannot fill them in: no bootstrap.
process.env.SUPER_ADMIN_EMAIL = '';
process.env.SUPER_ADMIN_INITIAL_PASSWORD = '';
