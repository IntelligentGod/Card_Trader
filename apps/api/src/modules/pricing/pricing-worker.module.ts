import { Logger, Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service';
import { DailySnapshotService } from './jobs/daily-snapshot.service';
import { PriceRefreshService } from './jobs/price-refresh.service';
import { PricingScheduler } from './jobs/pricing.scheduler';
import { PricingModule } from './pricing.module';
import { EbayPriceProvider } from './providers/ebay/ebay-price.provider';
import { MockPriceProvider } from './providers/mock/mock-price.provider';
import { PRICE_PROVIDERS, type PriceProvider } from './providers/price-provider.interface';

/** Worker-only: providers, refresh pipeline, and scheduled jobs. */
@Module({
  imports: [PricingModule],
  providers: [
    MockPriceProvider,
    EbayPriceProvider,
    {
      provide: PRICE_PROVIDERS,
      inject: [AppConfig, MockPriceProvider, EbayPriceProvider],
      useFactory: (config: AppConfig, mock: MockPriceProvider, ebay: EbayPriceProvider): PriceProvider[] => {
        const logger = new Logger('PriceProviders');
        const wanted = new Set(config.pricingProviderCodes);
        const enabled: PriceProvider[] = [];
        if (wanted.has(mock.code)) {
          if (config.isProduction) logger.warn('MOCK pricing provider is enabled in production');
          enabled.push(mock);
        }
        if (wanted.has(ebay.code)) {
          if (ebay.isConfigured) enabled.push(ebay);
          else logger.warn('EBAY requested but EBAY_CLIENT_ID/EBAY_CLIENT_SECRET are missing; skipping');
        }
        return enabled;
      },
    },
    PriceRefreshService,
    DailySnapshotService,
    PricingScheduler,
  ],
  exports: [PriceRefreshService, DailySnapshotService, PRICE_PROVIDERS],
})
export class PricingWorkerModule {}
