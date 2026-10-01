import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DailySnapshotService } from './daily-snapshot.service';
import { PriceRefreshService } from './price-refresh.service';

/**
 * MVP scheduling via cron inside the worker process. When volume grows these
 * triggers become BullMQ repeatable jobs; the services stay unchanged.
 */
@Injectable()
export class PricingScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(PricingScheduler.name);
  private refreshing = false;

  constructor(
    private readonly refresh: PriceRefreshService,
    private readonly snapshots: DailySnapshotService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Catch up immediately after a deploy/restart.
    await this.snapshots.run().catch((error) => this.logger.error(`Initial snapshot failed: ${String(error)}`));
    void this.refreshDue();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async refreshDue(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      // Drain due work in batches, but yield between batches.
      for (let i = 0; i < 20; i++) {
        const processed = await this.refresh.runBatch();
        if (processed === 0) break;
      }
    } catch (error) {
      this.logger.error(`Price refresh run failed: ${String(error)}`);
    } finally {
      this.refreshing = false;
    }
  }

  @Cron('10 0 * * *', { timeZone: 'UTC' })
  async dailySnapshot(): Promise<void> {
    await this.snapshots.run();
  }
}
