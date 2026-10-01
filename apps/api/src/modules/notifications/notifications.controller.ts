import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';
import type {
  MarkNotificationsReadRequest,
  NotificationResponse,
  Paginated,
  UnreadCountResponse,
} from '@card-trader/shared';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { CursorQueryDto } from '../../common/pagination/pagination';
import { NotificationsService } from './notifications.service';

class MarkReadDto implements MarkNotificationsReadRequest {
  @ApiPropertyOptional({ type: [String], description: 'omit to mark everything read' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  ids?: string[];
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: CursorQueryDto): Promise<Paginated<NotificationResponse>> {
    return this.notifications.list(user.userId, query);
  }

  /** Cheap enough to poll for the badge. */
  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser): Promise<UnreadCountResponse> {
    return this.notifications.unreadCount(user.userId);
  }

  @Post('read')
  @HttpCode(200)
  markRead(@CurrentUser() user: AuthUser, @Body() dto: MarkReadDto): Promise<UnreadCountResponse> {
    return this.notifications.markRead(user.userId, dto.ids);
  }
}
