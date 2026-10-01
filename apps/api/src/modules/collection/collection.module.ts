import { Module } from '@nestjs/common';
import { CardsModule } from '../cards/cards.module';
import { PricingModule } from '../pricing/pricing.module';
import { TradesModule } from '../trades/trades.module';
import { UsersModule } from '../users/users.module';
import { CollectionController, PublicCollectionController } from './collection.controller';
import { CollectionMapper } from './collection.mapper';
import { CollectionService } from './collection.service';

@Module({
  imports: [CardsModule, PricingModule, TradesModule, UsersModule],
  controllers: [CollectionController, PublicCollectionController],
  providers: [CollectionService, CollectionMapper],
  exports: [CollectionMapper],
})
export class CollectionModule {}
