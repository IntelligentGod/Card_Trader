import { Module } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { EventReminderService } from './event-reminder.service';

/** Worker-only: scheduled event reminders. (No HTTP controllers.) */
@Module({
  providers: [NotificationsService, EventReminderService],
  exports: [EventReminderService],
})
export class EventsWorkerModule {}
