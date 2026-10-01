import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Paginated, ReviewResponse } from '@card-trader/shared';
import { Errors } from '../../common/errors/app.exception';
import { pageArgs, toPage, type CursorQueryDto } from '../../common/pagination/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isReviewWindowOpen, TradeMapper } from '../trades/trade.mapper';
import { publicUserSelect } from '../users/user.mapper';
import { UsersService } from '../users/users.service';
import type { CreateReviewDto } from './dto/reviews.dto';

const reviewerInclude = { reviewer: { select: publicUserSelect } } as const;

/**
 * Review rules (enforced here AND by DB constraints):
 *  - only for COMPLETED trades, within the review window
 *  - reviewer must be a participant; the reviewed user is the other participant
 *  - one review per reviewer per trade; nobody reviews themselves
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly mapper: TradeMapper,
    private readonly notifications: NotificationsService,
  ) {}

  async create(userId: string, tradeId: string, dto: CreateReviewDto): Promise<ReviewResponse> {
    const trade = await this.prisma.trade.findFirst({
      where: { id: tradeId, participants: { some: { userId } } },
      include: { participants: true },
    });
    if (!trade) throw Errors.notFound('TRADE_NOT_FOUND', 'Trade not found');
    if (trade.status !== 'COMPLETED') {
      throw Errors.conflict('TRADE_NOT_COMPLETED', 'Only completed trades can be reviewed');
    }
    if (!isReviewWindowOpen(trade.completedAt)) {
      throw Errors.conflict('REVIEW_WINDOW_CLOSED', 'The review window for this trade has closed');
    }
    const reviewed = trade.participants.find((p) => p.userId !== userId);
    if (!reviewed) throw Errors.conflict('INVALID_TRADE', 'This trade has no other participant');

    try {
      const review = await this.prisma.$transaction(async (tx) => {
        const created = await tx.review.create({
          data: {
            tradeId: trade.id,
            reviewerId: userId,
            reviewedUserId: reviewed.userId,
            rating: dto.rating,
            comment: dto.comment ?? null,
          },
          include: reviewerInclude,
        });
        await tx.profile.update({
          where: { userId: reviewed.userId },
          data: { ratingSum: { increment: dto.rating }, ratingCount: { increment: 1 } },
        });
        const reviewerName = created.reviewer.profile?.displayName ?? 'Your trade partner';
        await this.notifications.notify(tx, {
          userId: reviewed.userId,
          type: 'REVIEW_RECEIVED',
          title: 'New review',
          body: reviewerName + ' left you a ' + dto.rating + '-star review.',
          data: { tradeId: trade.id },
        });
        return created;
      });
      return this.mapper.toReview(review);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw Errors.conflict('ALREADY_REVIEWED', 'You already reviewed this trade');
      }
      throw error;
    }
  }

  async listForUser(publicId: string, query: CursorQueryDto): Promise<Paginated<ReviewResponse>> {
    const user = await this.users.findActiveByPublicId(publicId);
    const rows = await this.prisma.review.findMany({
      where: { reviewedUserId: user.id },
      include: reviewerInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageArgs(query),
    });
    return toPage(rows, query, (row) => this.mapper.toReview(row));
  }
}
