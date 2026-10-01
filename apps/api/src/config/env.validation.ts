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
  return config;
}
