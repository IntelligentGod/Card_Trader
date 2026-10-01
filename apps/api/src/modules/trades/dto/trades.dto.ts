import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Matches, Max, Min, ValidateIf } from 'class-validator';
import type {
  AddTradeItemRequest,
  CreateTradeRequest,
  SetTradeCashRequest,
  TradeRole,
  TradeVersionRequest,
} from '@card-trader/shared';
import { CursorQueryDto } from '../../../common/pagination/pagination';
import { MAX_PRICE_CENTS, MAX_QUANTITY } from '../../collection/dto/collection.dto';

export class CreateTradeDto implements CreateTradeRequest {
  @ApiProperty({ description: 'public id of the other trader (from their QR code)' })
  @Matches(/^[A-Za-z0-9_-]{10,16}$/, { message: 'Invalid public id' })
  counterpartyPublicId: string;

  @ApiPropertyOptional({ description: 'card show the trade is started from (Search This Event)' })
  @IsOptional()
  @IsUUID()
  eventId?: string;
}

export class AddTradeItemDto implements AddTradeItemRequest {
  @ApiProperty()
  @IsUUID()
  collectionItemId: string;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_QUANTITY, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity?: number;
}

export class SetTradeCashDto implements SetTradeCashRequest {
  @ApiPropertyOptional({ enum: ['INITIATOR', 'COUNTERPARTY'], nullable: true, description: 'who pays the cash' })
  @ValidateIf((_, v) => v !== null)
  @IsIn(['INITIATOR', 'COUNTERPARTY'])
  payer: TradeRole | null;

  @ApiProperty({ minimum: 0, maximum: MAX_PRICE_CENTS })
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_CENTS)
  amountCents: number;

  @ApiPropertyOptional({ description: 'true resets to the server-suggested cash amount' })
  @IsOptional()
  @IsBoolean()
  useSuggested?: boolean;
}

export class TradeVersionDto implements TradeVersionRequest {
  @ApiProperty({ description: 'the trade version the user reviewed' })
  @IsInt()
  @Min(1)
  expectedVersion: number;
}

export class TradeListQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: ['active', 'history'], default: 'active' })
  @IsOptional()
  @IsIn(['active', 'history'])
  scope?: 'active' | 'history';
}
