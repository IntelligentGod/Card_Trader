import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

const toInt = ({ value }: { value: unknown }) => (value === undefined || value === '' ? undefined : Number(value));
/** "KEY=" in an env file means not set. */
const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);
const toBool = ({ value }: { value: unknown }) => value === true || value === 'true' || value === '1';

/** Environment is validated at boot: the process refuses to start with bad config. */
export class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  /** 127.0.0.1 when a reverse proxy on the same machine is the only way in. */
  @IsString()
  HOST = '0.0.0.0';

  @IsString()
  @MinLength(1)
  DATABASE_URL: string;

  @IsString()
  @MinLength(32, { message: 'JWT_ACCESS_SECRET must be at least 32 characters' })
  JWT_ACCESS_SECRET: string;

  @Transform(toInt)
  @IsInt()
  @Min(60)
  @Max(3600)
  JWT_ACCESS_TTL_SECONDS = 900;

  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(365)
  REFRESH_TOKEN_TTL_DAYS = 30;

  @IsUrl({ require_tld: false, require_protocol: true })
  PUBLIC_BASE_URL = 'http://localhost:3000';

  @IsIn(['local'])
  STORAGE_DRIVER: 'local' = 'local';

  @IsString()
  STORAGE_LOCAL_DIR = './uploads';

  @Transform(toBool)
  @IsBoolean()
  SWAGGER_ENABLED = false;

  @Transform(toInt)
  @IsInt()
  @Min(0)
  TRUST_PROXY = 0;

  /** Comma-separated browser origins allowed to call the API (the admin website). Empty = no CORS. */
  @IsString()
  CORS_ORIGINS = '';

  // ── Super admin bootstrap (created once on startup if the email has no account) ──
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  SUPER_ADMIN_EMAIL?: string;

  /** Never commit this. Only read when the super admin account does not exist yet. */
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MinLength(12, { message: 'SUPER_ADMIN_INITIAL_PASSWORD must be at least 12 characters' })
  SUPER_ADMIN_INITIAL_PASSWORD?: string;

  // ── Google / Apple sign-in: the `aud` values our ID tokens may carry ──
  /** Comma-separated OAuth client ids (the Web client id the app passes to Google Sign-In, plus iOS/Android ids). */
  @IsString()
  GOOGLE_CLIENT_IDS = '';

  /** Comma-separated Apple audiences: the iOS bundle id (com.cardtrader.app). */
  @IsString()
  APPLE_CLIENT_IDS = '';

  // ── Two-factor authentication ──
  /** 32 random bytes, base64. Encrypts TOTP secrets at rest. Changing it disables every user's 2FA. */
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  TWO_FACTOR_ENCRYPTION_KEY?: string;

  /** Shown in authenticator apps next to the account. */
  @IsString()
  TWO_FACTOR_ISSUER = 'Card Trader';

  // ── One-time unlock (Google Play / App Store through RevenueCat) ──
  /** false until the store products exist: every account has full access meanwhile */
  @Transform(toBool)
  @IsBoolean()
  PAYWALL_ENABLED = false;

  /** RevenueCat secret API key (server side only); empty = purchases can't be confirmed yet */
  @IsOptional()
  @IsString()
  REVENUECAT_SECRET_KEY?: string;

  /** value RevenueCat sends in the webhook's Authorization header */
  @IsOptional()
  @IsString()
  REVENUECAT_WEBHOOK_SECRET?: string;

  /** RevenueCat entitlement identifier the unlock grants */
  @IsString()
  PURCHASE_ENTITLEMENT_ID = 'full_access';

  @IsString()
  PRICING_PROVIDERS = 'MOCK';

  @IsOptional()
  @IsString()
  EBAY_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  EBAY_CLIENT_SECRET?: string;

  @IsString()
  EBAY_MARKETPLACE_ID = 'EBAY_US';

  @Transform(toInt)
  @IsInt()
  @Min(1)
  EBAY_REQUESTS_PER_MINUTE = 30;

  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(500)
  PRICE_REFRESH_BATCH_SIZE = 25;
}

export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  const config = plainToInstance(EnvironmentVariables, raw, { exposeDefaultValues: true });
  const errors = validateSync(config, { skipMissingProperties: false, whitelist: false });
  if (errors.length > 0) {
    const details = errors.map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`);
    throw new Error(`Invalid environment configuration:\n  ${details.join('\n  ')}`);
  }
  if (config.NODE_ENV === 'production' && config.JWT_ACCESS_SECRET.startsWith('change-me')) {
    throw new Error('JWT_ACCESS_SECRET must be changed in production');
  }
  if (config.TWO_FACTOR_ENCRYPTION_KEY && Buffer.from(config.TWO_FACTOR_ENCRYPTION_KEY, 'base64').length !== 32) {
    throw new Error('TWO_FACTOR_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  }
  if (config.NODE_ENV === 'production') {
    if (!config.TWO_FACTOR_ENCRYPTION_KEY) throw new Error('TWO_FACTOR_ENCRYPTION_KEY is required in production');
  }
  return config;
}
