import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from './env.validation';

/** Typed accessor over validated env. Inject this instead of ConfigService. */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  get<K extends keyof EnvironmentVariables>(key: K): EnvironmentVariables[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  get pricingProviderCodes(): string[] {
    return this.get('PRICING_PROVIDERS')
      .split(',')
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);
  }
}
