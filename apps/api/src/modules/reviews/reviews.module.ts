import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { TradesModule } from '../trades/trades.module';
import { UsersModule } from '../users/users.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [TradesModule, UsersModule, NotificationsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
