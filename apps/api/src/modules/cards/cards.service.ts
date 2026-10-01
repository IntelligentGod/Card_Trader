import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CardSetSummary, CardSummary, Paginated } from '@card-trader/shared';
import { Errors } from '../../common/errors/app.exception';
import { pageArgs, toPage } from '../../common/pagination/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { cardWithSetInclude, toCardSetSummary, toCardSummary, type CardWithSet } from './card.mapper';
import type { CardSearchQueryDto, CreateCardDto, SetSearchQueryDto } from './dto/cards.dto';

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Verified catalog cards plus the caller's own pending submissions. */
  private visibleTo(userId: string): Prisma.CardWhereInput {
    return { OR: [{ isVerified: true }, { submittedById: userId }] };
  }

  async search(userId: string, query: CardSearchQueryDto): Promise<Paginated<CardSummary>> {
    const and: Prisma.CardWhereInput[] = [this.visibleTo(userId)];
    if (query.category) and.push({ category: query.category });
    if (query.setId) and.push({ setId: query.setId });
    if (query.q) {
      const q = query.q;
      and.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { subject: { contains: q, mode: 'insensitive' } },
          { cardNumber: { equals: q, mode: 'insensitive' } },
          { set: { name: { contains: q, mode: 'insensitive' } } },
          { set: { code: { equals: q, mode: 'insensitive' } } },
        ],
      });
    }

    const rows = await this.prisma.card.findMany({
      where: { AND: and },
      include: cardWithSetInclude,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      ...pageArgs(query),
    });
    return toPage(rows, query, toCardSummary);
  }

  async getById(userId: string, cardId: string): Promise<CardSummary> {
    return toCardSummary(await this.requireVisible(userId, cardId));
  }

  async requireVisible(userId: string, cardId: string): Promise<CardWithSet> {
    const card = await this.prisma.card.findFirst({
      where: { AND: [{ id: cardId }, this.visibleTo(userId)] },
      include: cardWithSetInclude,
    });
    if (!card) throw Errors.notFound('CARD_NOT_FOUND', 'Card not found');
    return card;
  }

  /** Users can add a missing card; it stays unverified (visible only to them) until reviewed. */
  async submit(userId: string, dto: CreateCardDto): Promise<CardSummary> {
    const set = await this.prisma.cardSet.findUnique({ where: { id: dto.setId } });
    if (!set) throw Errors.notFound('SET_NOT_FOUND', 'Set not found');

    const variant = dto.variant ?? '';
    const existing = await this.prisma.card.findUnique({
      where: { setId_cardNumber_variant: { setId: set.id, cardNumber: dto.cardNumber, variant } },
    });
    if (existing) {
      throw Errors.conflict('CARD_EXISTS', 'This card already exists in the catalog', { cardId: existing.id });
    }

    const card = await this.prisma.card.create({
      data: {
        setId: set.id,
        category: set.category,
        name: dto.name,
        cardNumber: dto.cardNumber,
        variant,
        subject: dto.subject ?? null,
        rarity: dto.rarity ?? null,
        imageUrl: dto.imageUrl ?? null,
        source: 'USER_SUBMITTED',
        isVerified: false,
        submittedById: userId,
      },
      include: cardWithSetInclude,
    });
    return toCardSummary(card);
  }

  async listSets(query: SetSearchQueryDto): Promise<CardSetSummary[]> {
    const sets = await this.prisma.cardSet.findMany({
      where: {
        ...(query.category && { category: query.category }),
        ...(query.q && {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { code: { contains: query.q, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: [{ year: 'desc' }, { name: 'asc' }],
      take: 100,
    });
    return sets.map(toCardSetSummary);
  }
}
