import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule } from './config/config.module';
import { EventsWorkerModule } from './modules/events/events-worker.module';
import { PricingWorkerModule } from './modules/pricing/pricing-worker.module';
import { PrismaModule } from './prisma/prisma.module';

/** Background process: price refresh, daily snapshots, event reminders. No HTTP server. */
@Module({
  imports: [AppConfigModule, PrismaModule, ScheduleModule.forRoot(), PricingWorkerModule, EventsWorkerModule],
})
export class WorkerModule {}
