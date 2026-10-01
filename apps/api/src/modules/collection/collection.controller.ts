import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type {
  CardValueHistoryResponse,
  CollectionItemResponse,
  MarketValueResponse,
  Paginated,
  PublicCollectionItem,
} from '@card-trader/shared';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { PublicCollectionQueryDto } from '../users/dto/users.dto';
import { CollectionService } from './collection.service';
import { CollectionQueryDto, CreateCollectionItemDto, ItemRangeQueryDto, UpdateCollectionItemDto } from './dto/collection.dto';

@ApiTags('collection')
@ApiBearerAuth()
@Controller('collection')
export class CollectionController {
  constructor(private readonly collection: CollectionService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: CollectionQueryDto): Promise<Paginated<CollectionItemResponse>> {
    return this.collection.list(user.userId, query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCollectionItemDto): Promise<CollectionItemResponse> {
    return this.collection.create(user.userId, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<CollectionItemResponse> {
    return this.collection.get(user.userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCollectionItemDto,
  ): Promise<CollectionItemResponse> {
    return this.collection.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.collection.remove(user.userId, id);
  }

  @Get(':id/price-history')
  priceHistory(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ItemRangeQueryDto,
  ): Promise<CardValueHistoryResponse> {
    return this.collection.priceHistory(user.userId, id, query.range ?? '30d');
  }

  @Get(':id/market-value')
  marketValue(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<MarketValueResponse> {
    return this.collection.marketValue(user.userId, id);
  }
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users/:publicId/collection')
export class PublicCollectionController {
  constructor(private readonly collection: CollectionService) {}

  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  list(
    @Param('publicId') publicId: string,
    @Query() query: PublicCollectionQueryDto,
  ): Promise<Paginated<PublicCollectionItem>> {
    return this.collection.listPublic(publicId, query);
  }
}
