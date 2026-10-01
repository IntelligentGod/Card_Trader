import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl, IsUUID, Length, MaxLength } from 'class-validator';
import { CARD_CATEGORIES, type CardCategory, type CreateCardRequest } from '@card-trader/shared';
import { CursorQueryDto } from '../../../common/pagination/pagination';
import { SanitizedText } from '../../../common/validation/transforms';

export class CardSearchQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ maxLength: 60, description: 'name, character/player, or card number' })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @MaxLength(60)
  q?: string;

  @ApiPropertyOptional({ enum: CARD_CATEGORIES })
  @IsOptional()
  @IsIn(CARD_CATEGORIES)
  category?: CardCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  setId?: string;
}

export class SetSearchQueryDto {
  @ApiPropertyOptional({ enum: CARD_CATEGORIES })
  @IsOptional()
  @IsIn(CARD_CATEGORIES)
  category?: CardCategory;

  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @MaxLength(60)
  q?: string;
}

export class CreateCardDto implements CreateCardRequest {
  @ApiProperty()
  @IsUUID()
  setId: string;

  @ApiProperty({ maxLength: 120 })
  @SanitizedText()
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiProperty({ maxLength: 32 })
  @SanitizedText()
  @IsString()
  @Length(1, 32)
  cardNumber: string;

  @ApiPropertyOptional({ maxLength: 80, description: 'e.g. "Holo", "Refractor", "Alt Art"' })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @MaxLength(80)
  variant?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @MaxLength(120)
  subject?: string;

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @MaxLength(40)
  rarity?: string;

  @ApiPropertyOptional({ description: 'https image URL' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  imageUrl?: string;
}
