import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  MOVER_WINDOWS,
  type CollectionItemResponse,
  type Mover,
  type MoverWindow,
  type PortfolioSummary,
  type PortfolioValueHistory,
} from '@card-trader/shared';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { RangeQueryDto } from '../pricing/dto/pricing.dto';
import { PortfolioService } from './portfolio.service';

class LimitQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

class MoversQueryDto extends LimitQueryDto {
  @ApiPropertyOptional({ enum: ['up', 'down'], default: 'up' })
  @IsOptional()
  @IsIn(['up', 'down'])
  direction?: 'up' | 'down';

  @ApiPropertyOptional({ enum: MOVER_WINDOWS, default: '7d' })
  @IsOptional()
  @IsIn(MOVER_WINDOWS)
  window?: MoverWindow;
}

@ApiTags('portfolio')
@ApiBearerAuth()
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser): Promise<PortfolioSummary> {
    return this.portfolio.summary(user.userId);
  }

  @Get('value-history')
  valueHistory(@CurrentUser() user: AuthUser, @Query() query: RangeQueryDto): Promise<PortfolioValueHistory> {
    return this.portfolio.valueHistory(user.userId, query.range ?? '30d');
  }

  @Get('top-cards')
  topCards(@CurrentUser() user: AuthUser, @Query() query: LimitQueryDto): Promise<CollectionItemResponse[]> {
    return this.portfolio.topCards(user.userId, query.limit ?? 5);
  }

  @Get('movers')
  movers(@CurrentUser() user: AuthUser, @Query() query: MoversQueryDto): Promise<Mover[]> {
    return this.portfolio.movers(user.userId, query.direction ?? 'up', query.window ?? '7d', query.limit ?? 5);
  }
}
