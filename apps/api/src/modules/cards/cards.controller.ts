import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CardSetSummary, CardSummary, Paginated } from '@card-trader/shared';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { CardsService } from './cards.service';
import { CardSearchQueryDto, CreateCardDto, SetSearchQueryDto } from './dto/cards.dto';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller()
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get('cards')
  search(@CurrentUser() user: AuthUser, @Query() query: CardSearchQueryDto): Promise<Paginated<CardSummary>> {
    return this.cards.search(user.userId, query);
  }

  @Get('cards/:id')
  getById(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<CardSummary> {
    return this.cards.getById(user.userId, id);
  }

  @Post('cards')
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  submit(@CurrentUser() user: AuthUser, @Body() dto: CreateCardDto): Promise<CardSummary> {
    return this.cards.submit(user.userId, dto);
  }

  @Get('sets')
  listSets(@Query() query: SetSearchQueryDto): Promise<CardSetSummary[]> {
    return this.cards.listSets(query);
  }
}
