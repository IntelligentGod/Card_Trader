import { Injectable } from '@nestjs/common';
import type { AdminTargetType, Prisma } from '@prisma/client';
import type { AdminAuditEntry, Paginated } from '@card-trader/shared';
import { pageArgs, toPage, type CursorQueryDto } from '../../common/pagination/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import type { Actor } from './admin-policy';

type Db = Prisma.TransactionClient | PrismaService;
export type FieldChanges = Record<string, { from: unknown; to: unknown }>;

/** History shown per user/card; the console is for lookups, not exports. */
const HISTORY_LIMIT = 100;
/** Target id for app-wide actions (announcements). */
export const SYSTEM_TARGET_ID = '00000000-0000-0000-0000-000000000000';

const auditInclude = {
  admin: { select: { publicId: true, email: true, role: true, profile: { select: { displayName: true } } } },
} satisfies Prisma.AdminAuditLogInclude;
type AuditRow = Prisma.AdminAuditLogGetPayload<{ include: typeof auditInclude }>;

/** Fields in `next` whose value differs from `current` (both sides normalised to null). */
export function diffFields(current: Record<string, unknown>, next: Record<string, unknown>): FieldChanges {
  const changes: FieldChanges = {};
  for (const [field, to] of Object.entries(next)) {
    if (to === undefined) continue;
    const from = current[field] ?? null;
    if (JSON.stringify(from) !== JSON.stringify(to ?? null)) changes[field] = { from, to: to ?? null };
  }
  return changes;
}

export interface AuditEntryInput {
  adminId: string;
  targetType: AdminTargetType;
  targetId: string;
  action: string;
  changes: FieldChanges;
  reason?: string | null;
  ipAddress?: string | null;
}

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(db: Db, entry: AuditEntryInput): Promise<void> {
    await db.adminAuditLog.create({
      data: {
        adminId: entry.adminId,
        targetType: entry.targetType,
        targetId: entry.targetId,
        action: entry.action,
        changes: entry.changes as Prisma.InputJsonValue,
        reason: entry.reason ?? null,
        ipAddress: entry.ipAddress?.slice(0, 64) ?? null,
      },
    });
  }

  async history(viewer: Actor, targetType: AdminTargetType, targetId: string): Promise<AdminAuditEntry[]> {
    const rows = await this.prisma.adminAuditLog.findMany({
      where: { targetType, targetId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
      include: auditInclude,
    });
    return this.toEntries(viewer, rows);
  }

  /** The whole log, newest first. Callers restrict this to SUPER_ADMIN. */
  async list(viewer: Actor, query: CursorQueryDto & { action?: string; targetType?: AdminTargetType }): Promise<Paginated<AdminAuditEntry>> {
    const rows = await this.prisma.adminAuditLog.findMany({
      where: { ...(query.action && { action: query.action }), ...(query.targetType && { targetType: query.targetType }) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: auditInclude,
      ...pageArgs(query),
    });
    const page = toPage(rows, query, (row) => row);
    return { data: await this.toEntries(viewer, page.data), nextCursor: page.nextCursor };
  }

  /**
   * Normal admins never learn who the super admin is: actions taken by a super
   * admin show as "Administrator", and IP addresses stay hidden.
   */
  private async toEntries(viewer: Actor, rows: AuditRow[]): Promise<AdminAuditEntry[]> {
    const isSuper = viewer.role === 'SUPER_ADMIN';
    const userTargetIds = [...new Set(rows.filter((r) => r.targetType === 'USER').map((r) => r.targetId))];
    const targets = userTargetIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userTargetIds } },
          select: { id: true, publicId: true, role: true, profile: { select: { displayName: true } } },
        })
      : [];
    const targetById = new Map(targets.map((t) => [t.id, t]));

    return rows.map((row) => {
      const hideActor = !isSuper && row.admin.role === 'SUPER_ADMIN';
      const target = row.targetType === 'USER' ? targetById.get(row.targetId) : undefined;
      return {
        id: row.id,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        changes: (row.changes ?? {}) as FieldChanges,
        reason: row.reason,
        admin: hideActor
          ? { publicId: null, email: null, displayName: 'Administrator' }
          : { publicId: row.admin.publicId, email: row.admin.email, displayName: row.admin.profile?.displayName ?? 'Admin' },
        target:
          target && (isSuper || target.role !== 'SUPER_ADMIN')
            ? { publicId: target.publicId, displayName: target.profile?.displayName ?? 'Collector' }
            : null,
        ipAddress: isSuper ? row.ipAddress : null,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }
}
