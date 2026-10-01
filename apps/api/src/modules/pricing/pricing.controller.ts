import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { CardValueHistoryResponse, MarketValueResponse, SaleRecord } from '@card-trader/shared';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { CardsService } from '../cards/cards.service';
import { SalesQueryDto, TierQueryDto, ValueHistoryQueryDto } from './dto/pricing.dto';
import { PricingReadService } from './pricing-read.service';

@ApiTags('pricing')
@ApiBearerAuth()
@Controller('cards/:id')
export class PricingController {
  constructor(
    private readonly cards: CardsService,
    private readonly pricing: PricingReadService,
  ) {}

  @Get('market-value')
  async marketValue(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TierQueryDto,
  ): Promise<MarketValueResponse> {
    await this.cards.requireVisible(user.userId, id);
    return this.pricing.marketValueFor(id, query.tier ?? 'RAW');
  }

  @Get('sales')
  async sales(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: SalesQueryDto,
  ): Promise<SaleRecord[]> {
    await this.cards.requireVisible(user.userId, id);
    return this.pricing.recentSales(id, query.tier ?? 'RAW', query.limit ?? 3);
  }

  @Get('value-history')
  async valueHistory(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ValueHistoryQueryDto,
  ): Promise<CardValueHistoryResponse> {
    await this.cards.requireVisible(user.userId, id);
    return this.pricing.valueHistory(id, query.tier ?? 'RAW', query.range ?? '30d');
  }
}
