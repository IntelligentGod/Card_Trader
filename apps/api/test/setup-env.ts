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
