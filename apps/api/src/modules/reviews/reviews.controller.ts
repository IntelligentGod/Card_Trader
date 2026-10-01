import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Paginated, ReviewResponse } from '@card-trader/shared';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { CursorQueryDto } from '../../common/pagination/pagination';
import { CreateReviewDto } from './dto/reviews.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@ApiBearerAuth()
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post('trades/:tradeId/reviews')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(
    @CurrentUser() user: AuthUser,
    @Param('tradeId', ParseUUIDPipe) tradeId: string,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewResponse> {
    return this.reviews.create(user.userId, tradeId, dto);
  }

  @Get('users/:publicId/reviews')
  list(@Param('publicId') publicId: string, @Query() query: CursorQueryDto): Promise<Paginated<ReviewResponse>> {
    return this.reviews.listForUser(publicId, query);
  }
}
