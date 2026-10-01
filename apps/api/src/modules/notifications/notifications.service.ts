import { Injectable } from '@nestjs/common';
import type { Notification, NotificationType, Prisma } from '@prisma/client';
import type {
  NotificationData,
  NotificationResponse,
  Paginated,
  UnreadCountResponse,
} from '@card-trader/shared';
import { pageArgs, toPage, type CursorQueryDto } from '../../common/pagination/pagination';
import { toIso } from '../../common/utils/dates';
import { PrismaService, type Tx } from '../../prisma/prisma.service';

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
}

/** Notifications older than this are pruned when a user reads their list. */
export const NOTIFICATION_RETENTION_DAYS = 90;
const TITLE_MAX = 120;
const BODY_MAX = 300;

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function readData(json: Prisma.JsonValue): NotificationData {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) return {};
  const data: NotificationData = {};
  for (const key of ['tradeId', 'eventId', 'publicId'] as const) {
    const value = (json as Record<string, unknown>)[key];
    if (typeof value === 'string') data[key] = value;
  }
  return data;
}

function toResponse(row: Notification): NotificationResponse {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: readData(row.data),
    readAt: toIso(row.readAt),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * In-app notification inbox. Writers call `notify` inside their own
 * transaction, so a notification exists exactly when the change it describes
 * was committed. (Push delivery can later fan out from these rows.)
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(tx: Tx, input: NotificationInput | NotificationInput[]): Promise<void> {
    const rows = (Array.isArray(input) ? input : [input]).map((n) => ({
      userId: n.userId,
      type: n.type,
      title: clip(n.title, TITLE_MAX),
      body: clip(n.body, BODY_MAX),
      data: (n.data ?? {}) as Prisma.InputJsonObject,
    }));
    if (rows.length > 0) await tx.notification.createMany({ data: rows });
  }

  async list(userId: string, query: CursorQueryDto): Promise<Paginated<NotificationResponse>> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageArgs(query),
    });
    return toPage(rows, query, toResponse);
  }

  async unreadCount(userId: string): Promise<UnreadCountResponse> {
    return { count: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  /** Marks the given notifications (or all) as read. Other users' ids are ignored. */
  async markRead(userId: string, ids: string[] | undefined): Promise<UnreadCountResponse> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids && { id: { in: ids } }) },
      data: { readAt: new Date() },
    });
    const cutoff = new Date(Date.now() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.notification.deleteMany({ where: { userId, createdAt: { lt: cutoff } } });
    return this.unreadCount(userId);
  }
}
