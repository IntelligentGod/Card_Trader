import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Paginated, TradeListItem, TradeResponse } from '@card-trader/shared';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { AddTradeItemDto, CreateTradeDto, SetTradeCashDto, TradeListQueryDto, TradeVersionDto } from './dto/trades.dto';
import { TradesService } from './trades.service';

@ApiTags('trades')
@ApiBearerAuth()
@Controller('trades')
export class TradesController {
  constructor(private readonly trades: TradesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTradeDto): Promise<TradeResponse> {
    return this.trades.create(user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: TradeListQueryDto): Promise<Paginated<TradeListItem>> {
    return this.trades.list(user.userId, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<TradeResponse> {
    return this.trades.get(user.userId, id);
  }

  @Post(':id/items')
  addItem(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddTradeItemDto,
  ): Promise<TradeResponse> {
    return this.trades.addItem(user.userId, id, dto);
  }

  @Delete(':id/items/:itemId')
  removeItem(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<TradeResponse> {
    return this.trades.removeItem(user.userId, id, itemId);
  }

  @Put(':id/cash')
  setCash(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetTradeCashDto,
  ): Promise<TradeResponse> {
    return this.trades.setCash(user.userId, id, dto);
  }

  @Post(':id/refresh-values')
  @HttpCode(200)
  refreshValues(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<TradeResponse> {
    return this.trades.refreshValues(user.userId, id);
  }

  @Post(':id/propose')
  @HttpCode(200)
  propose(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TradeVersionDto,
  ): Promise<TradeResponse> {
    return this.trades.propose(user.userId, id, dto.expectedVersion);
  }

  @Post(':id/accept')
  @HttpCode(200)
  accept(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TradeVersionDto,
  ): Promise<TradeResponse> {
    return this.trades.accept(user.userId, id, dto.expectedVersion);
  }

  @Post(':id/decline')
  @HttpCode(200)
  decline(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<TradeResponse> {
    return this.trades.decline(user.userId, id);
  }

  @Post(':id/complete')
  @HttpCode(200)
  complete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<TradeResponse> {
    return this.trades.complete(user.userId, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<TradeResponse> {
    return this.trades.cancel(user.userId, id);
  }
}
