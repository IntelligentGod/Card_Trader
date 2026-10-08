import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { PurchaseGuard } from './common/auth/purchase.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { AppConfig } from './config/app-config.service';
import { AppConfigModule } from './config/config.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { CardsModule } from './modules/cards/cards.module';
import { CollectionModule } from './modules/collection/collection.module';
import { EventsModule } from './modules/events/events.module';
import { HealthController } from './modules/health/health.controller';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { TradesModule } from './modules/trades/trades.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    JwtModule.registerAsync({
      global: true,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        secret: config.get('JWT_ACCESS_SECRET'),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
        // e2e tests register many users quickly; production always throttles.
        skipIf: () => config.get('NODE_ENV') === 'test',
      }),
    }),
    UploadsModule,
    UsersModule,
    AuthModule,
    CardsModule,
    PricingModule,
    TradesModule,
    CollectionModule,
    PortfolioModule,
    ReviewsModule,
    NotificationsModule,
    EventsModule,
    AdminModule,
    BillingModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Order matters: authenticate first, then check the role.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PurchaseGuard },
  ],
})
export class AppModule {}
