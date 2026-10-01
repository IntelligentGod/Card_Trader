import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { tierLabelFromKey, type AdminCardDetail, type AdminCardListItem, type Paginated } from '@card-trader/shared';
import { Errors } from '../../common/errors/app.exception';
import { pageArgs, toPage } from '../../common/pagination/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { toCardSetSummary } from '../cards/card.mapper';
import { publicUserSelect, UserMapper } from '../users/user.mapper';
import { AdminAuditService, diffFields } from './admin-audit.service';
import type { Actor } from './admin-policy';
import type { AdminContext } from './admin-users.service';
import type { AdminCardListQueryDto, AdminUpdateCardDto } from './dto/admin.dto';

const adminCardInclude = {
  set: true,
  submittedBy: { select: publicUserSelect },
  marketValues: { select: { valueCents: true } },
  _count: { select: { collectionItems: true } },
} satisfies Prisma.CardInclude;

type AdminCardRow = Prisma.CardGetPayload<{ include: typeof adminCardInclude }>;

/** The whole catalog, including unverified cards users submitted for themselves. */
@Injectable()
export class AdminCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UserMapper,
    private readonly audit: AdminAuditService,
  ) {}

  async list(query: AdminCardListQueryDto): Promise<Paginated<AdminCardListItem>> {
    const q = query.q?.trim();
    const rows = await this.prisma.card.findMany({
      where: {
        ...(query.category && { category: query.category }),
        ...(query.source && { source: query.source }),
        ...(query.verified !== undefined && { isVerified: query.verified }),
        ...(q && {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { cardNumber: { contains: q, mode: 'insensitive' } },
            { subject: { contains: q, mode: 'insensitive' } },
            { set: { name: { contains: q, mode: 'insensitive' } } },
          ],
        }),
      },
      include: adminCardInclude,
      // Unverified first: those are the ones waiting for review.
      orderBy: [{ isVerified: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
      ...pageArgs(query),
    });
    return toPage(rows, query, (row) => this.toListItem(row));
  }

  async get(viewer: Actor, id: string): Promise<AdminCardDetail> {
    const card = await this.prisma.card.findUnique({
      where: { id },
      include: { ...adminCardInclude, marketValues: { orderBy: { priceTierKey: 'asc' } } },
    });
    if (!card) throw cardNotFound();

    const [owners, copies, tradeItemCount, history] = await Promise.all([
      this.prisma.collectionItem.groupBy({ by: ['userId'], where: { cardId: id } }),
      this.prisma.collectionItem.aggregate({ where: { cardId: id }, _sum: { quantity: true } }),
      this.prisma.tradeItem.count({ where: { cardId: id } }),
      this.audit.history(viewer, 'CARD', id),
    ]);

    return {
      ...this.toListItem(card),
      externalRef: card.externalRef,
      ownerCount: owners.length,
      copies: copies._sum.quantity ?? 0,
      tradeItemCount,
      marketValues: card.marketValues.map((v) => ({
        tierKey: v.priceTierKey,
        tierLabel: tierLabelFromKey(v.priceTierKey),
        valueCents: v.valueCents,
        confidence: v.confidence,
        sampleSize: v.sampleSize,
        lastSaleAt: v.lastSaleAt?.toISOString() ?? null,
        computedAt: v.computedAt?.toISOString() ?? null,
      })),
      history,
      updatedAt: card.updatedAt.toISOString(),
    };
  }

  async update(ctx: AdminContext, id: string, dto: AdminUpdateCardDto): Promise<AdminCardDetail> {
    const card = await this.prisma.card.findUnique({ where: { id } });
    if (!card) throw cardNotFound();

    const changes = diffFields(
      { name: card.name, cardNumber: card.cardNumber, variant: card.variant, subject: card.subject, rarity: card.rarity, imageUrl: card.imageUrl, isVerified: card.isVerified },
      { name: dto.name, cardNumber: dto.cardNumber, variant: dto.variant, subject: dto.subject, rarity: dto.rarity, imageUrl: dto.imageUrl, isVerified: dto.isVerified },
    );
    if (Object.keys(changes).length === 0) return this.get(ctx, id);

    const fields = Object.keys(changes);
    const action =
      fields.length === 1 && changes.isVerified ? (dto.isVerified ? 'CARD_VERIFIED' : 'CARD_UNVERIFIED') : 'CARD_UPDATED';

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.card.update({
          where: { id },
          data: {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.cardNumber !== undefined && { cardNumber: dto.cardNumber }),
            ...(dto.variant !== undefined && { variant: dto.variant }),
            ...(dto.subject !== undefined && { subject: dto.subject }),
            ...(dto.rarity !== undefined && { rarity: dto.rarity }),
            ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
            ...(dto.isVerified !== undefined && { isVerified: dto.isVerified }),
          },
        });
        await this.audit.record(tx, { adminId: ctx.userId, targetType: 'CARD', targetId: id, action, changes, reason: dto.reason, ipAddress: ctx.ipAddress });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw Errors.conflict('CARD_EXISTS', 'Another card in this set already has that number and variant');
      }
      throw error;
    }
    return this.get(ctx, id);
  }

  private toListItem(card: AdminCardRow): AdminCardListItem {
    const values = card.marketValues.map((v) => v.valueCents).filter((v): v is number => v !== null);
    return {
      id: card.id,
      category: card.category,
      name: card.name,
      cardNumber: card.cardNumber,
      variant: card.variant,
      subject: card.subject,
      rarity: card.rarity,
      imageUrl: card.imageUrl,
      set: toCardSetSummary(card.set),
      source: card.source,
      isVerified: card.isVerified,
      submittedBy: card.submittedBy ? this.users.toLite(card.submittedBy) : null,
      collectionItemCount: card._count.collectionItems,
      topValueCents: values.length > 0 ? Math.max(...values) : null,
      createdAt: card.createdAt.toISOString(),
    };
  }
}

const cardNotFound = () => Errors.notFound('CARD_NOT_FOUND', 'Card not found');
