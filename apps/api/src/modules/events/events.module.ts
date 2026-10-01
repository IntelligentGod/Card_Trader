import { Module } from '@nestjs/common';
import { CollectionModule } from '../collection/collection.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { EventMapper } from './event.mapper';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [UsersModule, CollectionModule, NotificationsModule],
  controllers: [EventsController],
  providers: [EventsService, EventMapper],
})
export class EventsModule {}
