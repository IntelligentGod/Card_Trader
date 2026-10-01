import { Injectable } from '@nestjs/common';
import type { AdminBroadcastResponse } from '@card-trader/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminAuditService, SYSTEM_TARGET_ID } from './admin-audit.service';
import { AuditAction } from './admin-policy';
import type { AdminContext } from './admin-users.service';
import type { AdminBroadcastDto } from './dto/admin.dto';

/** Inserted in chunks so one announcement never builds a giant statement. */
const CHUNK = 1000;

/** SUPER_ADMIN announcements: an ANNOUNCEMENT notification to every active user. */
@Injectable()
export class AdminBroadcastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AdminAuditService,
  ) {}

  async broadcast(ctx: AdminContext, dto: AdminBroadcastDto): Promise<AdminBroadcastResponse> {
    const recipients = await this.prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < recipients.length; i += CHUNK) {
        await this.notifications.notify(
          tx,
          recipients.slice(i, i + CHUNK).map((r) => ({ userId: r.id, type: 'ANNOUNCEMENT' as const, title: dto.title, body: dto.message })),
        );
      }
      await this.audit.record(tx, {
        adminId: ctx.userId,
        targetType: 'SYSTEM',
        targetId: SYSTEM_TARGET_ID,
        action: AuditAction.ANNOUNCEMENT_SENT,
        changes: { title: { from: null, to: dto.title }, recipients: { from: null, to: recipients.length } },
        ipAddress: ctx.ipAddress,
      });
    });
    return { recipients: recipients.length };
  }
}
