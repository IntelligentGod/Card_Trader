import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  CARD_CATEGORIES,
  CARD_CONDITIONS,
  GRADING_COMPANIES,
  LISTING_STATUSES,
  type CardCategory,
  type CardCondition,
  type CollectionSort,
  type CreateCollectionItemRequest,
  type GradingCompany,
  type ListingStatus,
  type UpdateCollectionItemRequest,
} from '@card-trader/shared';
import { CursorQueryDto } from '../../../common/pagination/pagination';
import { SanitizedText } from '../../../common/validation/transforms';

export const MAX_QUANTITY = 999;
export const MAX_PRICE_CENTS = 100_000_000; // $1,000,000

const COLLECTION_SORTS: CollectionSort[] = ['value_desc', 'value_asc', 'newest', 'name'];
const notNull = (_: object, value: unknown) => value !== null;

export class CreateCollectionItemDto implements CreateCollectionItemRequest {
  @ApiProperty()
  @IsUUID()
  cardId: string;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_QUANTITY, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity?: number;

  @ApiProperty({ enum: CARD_CONDITIONS })
  @IsIn(CARD_CONDITIONS)
  condition: CardCondition;

  @ApiPropertyOptional({ enum: GRADING_COMPANIES, nullable: true })
  @IsOptional()
  @ValidateIf(notNull)
  @IsIn(GRADING_COMPANIES)
  gradingCompany?: GradingCompany | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 10, nullable: true, example: 9.5 })
  @IsOptional()
  @ValidateIf(notNull)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(10)
  grade?: number | null;

  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(40)
  certNumber?: string | null;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_PRICE_CENTS, nullable: true })
  @IsOptional()
  @ValidateIf(notNull)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_CENTS)
  purchasePriceCents?: number | null;

  @ApiPropertyOptional({ example: '2025-09-12', nullable: true })
  @IsOptional()
  @ValidateIf(notNull)
  @IsISO8601({ strict: true })
  purchaseDate?: string | null;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'key from POST /uploads/images?purpose=ITEM_IMAGE' })
  @IsOptional()
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(255)
  customImageKey?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'back photo; key from POST /uploads/images?purpose=ITEM_IMAGE' })
  @IsOptional()
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(255)
  backImageKey?: string | null;

  @ApiPropertyOptional({ enum: LISTING_STATUSES, default: 'PERSONAL' })
  @IsOptional()
  @IsIn(LISTING_STATUSES)
  listingStatus?: ListingStatus;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_PRICE_CENTS, nullable: true, description: 'asking price per copy' })
  @IsOptional()
  @ValidateIf(notNull)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_CENTS)
  askingPriceCents?: number | null;
}

export class UpdateCollectionItemDto implements UpdateCollectionItemRequest {
  @ApiPropertyOptional({ minimum: 1, maximum: MAX_QUANTITY })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity?: number;

  @ApiPropertyOptional({ enum: CARD_CONDITIONS })
  @IsOptional()
  @IsIn(CARD_CONDITIONS)
  condition?: CardCondition;

  @ApiPropertyOptional({ enum: GRADING_COMPANIES, nullable: true })
  @IsOptional()
  @ValidateIf(notNull)
  @IsIn(GRADING_COMPANIES)
  gradingCompany?: GradingCompany | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf(notNull)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(10)
  grade?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(40)
  certNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf(notNull)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_CENTS)
  purchasePriceCents?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf(notNull)
  @IsISO8601({ strict: true })
  purchaseDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(255)
  customImageKey?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'back photo; key from POST /uploads/images?purpose=ITEM_IMAGE' })
  @IsOptional()
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(255)
  backImageKey?: string | null;

  @ApiPropertyOptional({ enum: LISTING_STATUSES })
  @IsOptional()
  @IsIn(LISTING_STATUSES)
  listingStatus?: ListingStatus;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_PRICE_CENTS, nullable: true, description: 'asking price per copy' })
  @IsOptional()
  @ValidateIf(notNull)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_CENTS)
  askingPriceCents?: number | null;
}

export class CollectionQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: CARD_CATEGORIES })
  @IsOptional()
  @IsIn(CARD_CATEGORIES)
  category?: CardCategory;

  @ApiPropertyOptional({ enum: LISTING_STATUSES })
  @IsOptional()
  @IsIn(LISTING_STATUSES)
  listingStatus?: ListingStatus;

  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @MaxLength(60)
  q?: string;

  @ApiPropertyOptional({ enum: COLLECTION_SORTS, default: 'newest' })
  @IsOptional()
  @IsIn(COLLECTION_SORTS)
  sort?: CollectionSort;
}

export class ItemRangeQueryDto {
  @ApiPropertyOptional({ enum: ['7d', '30d', '3m', '6m', '1y'], default: '30d' })
  @IsOptional()
  @Type(() => String)
  @IsIn(['7d', '30d', '3m', '6m', '1y'])
  range?: '7d' | '30d' | '3m' | '6m' | '1y';
}
