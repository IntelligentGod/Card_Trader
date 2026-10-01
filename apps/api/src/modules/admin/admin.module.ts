import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CollectionModule } from '../collection/collection.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TradesModule } from '../trades/trades.module';
import { UsersModule } from '../users/users.module';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminBroadcastService } from './admin-broadcast.service';
import { AdminCardsService } from './admin-cards.service';
import { AdminUsersService } from './admin-users.service';
import { AdminCardsController, AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SuperAdminBootstrap } from './super-admin.bootstrap';

@Module({
  imports: [UsersModule, TradesModule, CollectionModule, AuthModule, NotificationsModule],
  controllers: [AdminController, AdminCardsController],
  providers: [
    AdminService,
    AdminUsersService,
    AdminCardsService,
    AdminAnalyticsService,
    AdminAuditService,
    AdminBroadcastService,
    SuperAdminBootstrap,
  ],
})
export class AdminModule {}
