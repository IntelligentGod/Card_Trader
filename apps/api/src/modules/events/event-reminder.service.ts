import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export const REMINDER_LEAD_HOURS = 24;

/**
 * Worker job: "upcoming event" reminders for saved attendees and approved
 * vendors, sent once per event (reset when the organizer moves the start).
 * The claim is a single UPDATE … RETURNING, so parallel workers never send twice.
 * Columns are UTC timestamps without a zone, hence the explicit AT TIME ZONE.
 */
@Injectable()
export class EventReminderService {
  private readonly logger = new Logger(EventReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async runScheduled(): Promise<void> {
    try {
      const sent = await this.run();
      if (sent > 0) this.logger.log(`Sent reminders for ${sent} event(s)`);
    } catch (error) {
      this.logger.error(`Event reminders failed: ${String(error)}`);
    }
  }

  /** Returns the number of events reminded. */
  async run(now: Date = new Date()): Promise<number> {
    const horizon = new Date(now.getTime() + REMINDER_LEAD_HOURS * 60 * 60 * 1000);
    return this.prisma.$transaction(async (tx) => {
      const due = await tx.$queryRaw<{ id: string; title: string; organizerId: string; venueName: string }[]>`
        UPDATE "Event" SET "reminderSentAt" = (${now}::timestamptz AT TIME ZONE 'UTC')
        WHERE status = 'PUBLISHED' AND "reminderSentAt" IS NULL
          AND "startsAt" > (${now}::timestamptz AT TIME ZONE 'UTC')
          AND "startsAt" <= (${horizon}::timestamptz AT TIME ZONE 'UTC')
        RETURNING id, title, "organizerId", "venueName"`;

      for (const event of due) {
        const [saves, vendors] = await Promise.all([
          tx.eventSave.findMany({ where: { eventId: event.id }, select: { userId: true } }),
          tx.eventVendor.findMany({ where: { eventId: event.id, status: 'APPROVED' }, select: { vendorId: true } }),
        ]);
        const vendorIds = new Set(vendors.map((v) => v.vendorId));
        const userIds = new Set([...saves.map((s) => s.userId), ...vendorIds]);
        userIds.delete(event.organizerId);
        await this.notifications.notify(
          tx,
          [...userIds].map((userId) => ({
            userId,
            type: 'EVENT_REMINDER' as const,
            title: `${event.title} is coming up`,
            body: vendorIds.has(userId)
              ? `Starts within ${REMINDER_LEAD_HOURS} hours at ${event.venueName}. Check the cards you are bringing.`
              : `Starts within ${REMINDER_LEAD_HOURS} hours at ${event.venueName}. Search the show before you go.`,
            data: { eventId: event.id },
          })),
        );
      }
      return due.length;
    });
  }
}
