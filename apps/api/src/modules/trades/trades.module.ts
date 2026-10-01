import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PricingModule } from '../pricing/pricing.module';
import { UsersModule } from '../users/users.module';
import { TradeMaintenanceService } from './trade-maintenance.service';
import { TradeMapper } from './trade.mapper';
import { TradesController } from './trades.controller';
import { TradesService } from './trades.service';

@Module({
  imports: [UsersModule, PricingModule, NotificationsModule],
  controllers: [TradesController],
  providers: [TradesService, TradeMapper, TradeMaintenanceService],
  exports: [TradeMaintenanceService, TradeMapper],
})
export class TradesModule {}
