import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  CARD_CATEGORIES,
  CARD_CONDITIONS,
  GRADING_COMPANIES,
  type ApplyAsVendorRequest,
  type ApproveVendorRequest,
  type CardCategory,
  type CardCondition,
  type CardKind,
  type CreateEventRequest,
  type EventListScope,
  type EventSearchQuery,
  type GradingCompany,
  type SetEventInventoryRequest,
  type SocialLinks,
  type UpdateEventRequest,
} from '@card-trader/shared';
import { CursorQueryDto } from '../../../common/pagination/pagination';
import { IsSocialLinks, NormalizeSocialLinks } from '../../../common/validation/social-links';
import { SanitizedText } from '../../../common/validation/transforms';
import { MAX_PRICE_CENTS } from '../../collection/dto/collection.dto';
import { WEBSITE_URL_OPTIONS } from '../../users/dto/users.dto';

const notNull = (_: unknown, value: unknown) => value !== null;
/** "12", "A-4", "Booth 7" — short, printable. */
export const TABLE_NUMBER_PATTERN = /^[\p{L}\p{N} #._-]{1,20}$/u;
export const MAX_EVENT_INVENTORY = 500;

/** Query-string booleans: only the literal "true"/"false" are accepted. */
function BooleanQuery() {
  return Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value));
}

class EventFieldsDto {
  @ApiPropertyOptional({ maxLength: 4000, nullable: true })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(200)
  address?: string | null;

  @ApiPropertyOptional({ maxLength: 80, nullable: true, example: 'TX' })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(80)
  region?: string | null;

  @ApiPropertyOptional({ maxLength: 56, default: 'US' })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @Length(2, 56)
  country?: string;

  @ApiPropertyOptional({ maxLength: 120, nullable: true, example: '$10 · Kids under 12 free' })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(120)
  admission?: string | null;

  @ApiPropertyOptional({ maxLength: 80, nullable: true, description: 'shown instead of your name, e.g. a company' })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(80)
  organizerName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf(notNull)
  @IsUrl(WEBSITE_URL_OPTIONS, { message: 'Website must be a full http(s) link' })
  @MaxLength(200)
  website?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @NormalizeSocialLinks()
  @IsSocialLinks()
  socialLinks?: SocialLinks;
}

export class CreateEventDto extends EventFieldsDto implements CreateEventRequest {
  @ApiProperty({ minLength: 3, maxLength: 120, example: 'Austin Card Show' })
  @SanitizedText()
  @IsString()
  @Length(3, 120)
  title: string;

  @ApiProperty({ example: '2026-11-14T09:00:00-06:00' })
  @IsISO8601({ strict: true })
  startsAt: string;

  @ApiProperty({ example: '2026-11-14T17:00:00-06:00' })
  @IsISO8601({ strict: true })
  endsAt: string;

  @ApiProperty({ maxLength: 120, example: 'Palmer Events Center' })
  @SanitizedText()
  @IsString()
  @Length(2, 120)
  venueName: string;

  @ApiProperty({ maxLength: 80, example: 'Austin' })
  @SanitizedText()
  @IsString()
  @Length(2, 80)
  city: string;
}

export class UpdateEventDto extends EventFieldsDto implements UpdateEventRequest {
  @ApiPropertyOptional({ minLength: 3, maxLength: 120 })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @Length(3, 120)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601({ strict: true })
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601({ strict: true })
  endsAt?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @Length(2, 120)
  venueName?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @Length(2, 80)
  city?: string;
}

export const EVENT_LIST_SCOPES: EventListScope[] = ['upcoming', 'organizing', 'mine'];

export class EventListQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: EVENT_LIST_SCOPES, default: 'upcoming' })
  @IsOptional()
  @IsIn(EVENT_LIST_SCOPES)
  scope?: EventListScope;

  @ApiPropertyOptional({ maxLength: 60, description: 'title, venue or city' })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @MaxLength(60)
  q?: string;

  @ApiPropertyOptional({ description: 'public id: upcoming shows this vendor is approved for' })
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{10,16}$/, { message: 'Invalid public id' })
  vendor?: string;
}

export class ApplyAsVendorDto implements ApplyAsVendorRequest {
  @ApiPropertyOptional({ maxLength: 500, nullable: true, description: 'note to the organizer' })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(500)
  message?: string | null;
}

export class ApproveVendorDto implements ApproveVendorRequest {
  @ApiProperty({ example: '12' })
  @SanitizedText()
  @IsString()
  @Matches(TABLE_NUMBER_PATTERN, { message: 'Table number must be 1–20 letters, numbers, spaces or # . _ -' })
  tableNumber: string;
}

export class SetEventInventoryDto implements SetEventInventoryRequest {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(MAX_EVENT_INVENTORY)
  @IsUUID('all', { each: true })
  collectionItemIds: string[];
}

export class EventSearchQueryDto extends CursorQueryDto implements EventSearchQuery {
  @ApiPropertyOptional({ maxLength: 60, description: 'card name, player/character, number or set' })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @MaxLength(60)
  q?: string;

  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @MaxLength(60)
  set?: string;

  @ApiPropertyOptional({ minimum: 1900, maximum: 2100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ enum: CARD_CATEGORIES })
  @IsOptional()
  @IsIn(CARD_CATEGORIES)
  category?: CardCategory;

  @ApiPropertyOptional({ enum: ['RAW', 'GRADED'] })
  @IsOptional()
  @IsIn(['RAW', 'GRADED'])
  kind?: CardKind;

  @ApiPropertyOptional({ enum: GRADING_COMPANIES })
  @IsOptional()
  @IsIn(GRADING_COMPANIES)
  grader?: GradingCompany;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(10)
  grade?: number;

  @ApiPropertyOptional({ enum: CARD_CONDITIONS })
  @IsOptional()
  @IsIn(CARD_CONDITIONS)
  condition?: CardCondition;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_CENTS)
  minPriceCents?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_CENTS)
  maxPriceCents?: number;

  @ApiPropertyOptional({ description: 'only cards for sale' })
  @IsOptional()
  @BooleanQuery()
  @IsIn([true, false])
  forSale?: boolean;

  @ApiPropertyOptional({ description: 'only cards for trade' })
  @IsOptional()
  @BooleanQuery()
  @IsIn([true, false])
  forTrade?: boolean;
}
