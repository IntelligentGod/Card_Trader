import { Module } from '@nestjs/common';
import { CardsModule } from '../cards/cards.module';
import { MarketValueService } from './market-value/market-value.service';
import { MARKET_VALUE_STRATEGY, MedianOfLastNStrategy } from './market-value/market-value.strategy';
import { PriceTrackingService } from './price-tracking.service';
import { PricingReadService } from './pricing-read.service';
import { PricingController } from './pricing.controller';

/** Pricing pieces used by the API process (reads + tracking). No external calls. */
@Module({
  imports: [CardsModule],
  controllers: [PricingController],
  providers: [
    { provide: MARKET_VALUE_STRATEGY, useValue: new MedianOfLastNStrategy(3, 180) },
    MarketValueService,
    PricingReadService,
    PriceTrackingService,
  ],
  exports: [MarketValueService, PricingReadService, PriceTrackingService, MARKET_VALUE_STRATEGY],
})
export class PricingModule {}
