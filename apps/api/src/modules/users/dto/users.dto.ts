import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, Length, Matches, MaxLength, ValidateIf } from 'class-validator';
import {
  CARD_CATEGORIES,
  type CardCategory,
  type SocialLinks,
  type UpdateMeRequest,
  type UpsertVendorProfileRequest,
  USERNAME_PATTERN,
} from '@card-trader/shared';
import { CursorQueryDto } from '../../../common/pagination/pagination';
import { IsSocialLinks, NormalizeSocialLinks } from '../../../common/validation/social-links';
import { SanitizedText } from '../../../common/validation/transforms';
import { DISPLAY_NAME_PATTERN, NormalizeUsername, USERNAME_MESSAGE } from '../../auth/dto/auth.dto';

export const WEBSITE_URL_OPTIONS = { protocols: ['http', 'https'], require_protocol: true };

export class UpdateMeDto implements UpdateMeRequest {
  @ApiPropertyOptional({ example: 'tom_cards', pattern: USERNAME_PATTERN.source })
  @IsOptional()
  @NormalizeUsername()
  @IsString()
  @Matches(USERNAME_PATTERN, { message: USERNAME_MESSAGE })
  username?: string;

  @ApiPropertyOptional({ minLength: 2, maxLength: 40 })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @Length(2, 40)
  @Matches(DISPLAY_NAME_PATTERN, { message: 'Display name contains unsupported characters' })
  displayName?: string;

  @ApiPropertyOptional({ maxLength: 280, nullable: true })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(280)
  bio?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'key returned by POST /uploads/images?purpose=AVATAR' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(255)
  avatarKey?: string | null;

  @ApiPropertyOptional({ maxLength: 80, nullable: true, example: 'Austin, TX' })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(80)
  location?: string | null;

  @ApiPropertyOptional({ example: { instagram: '@tomcards', website: 'https://tomcards.com' } })
  @IsOptional()
  @NormalizeSocialLinks()
  @IsSocialLinks()
  socialLinks?: SocialLinks;
}

export class UpsertVendorProfileDto implements UpsertVendorProfileRequest {
  @ApiProperty({ description: 'false switches Vendor Mode off but keeps the details' })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({ minLength: 2, maxLength: 60, example: 'Tom’s Card Corner' })
  @SanitizedText()
  @IsString()
  @Length(2, 60)
  businessName: string;

  @ApiPropertyOptional({ nullable: true, description: 'key returned by POST /uploads/images?purpose=VENDOR_LOGO' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(255)
  logoKey?: string | null;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'https://tomscards.com' })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf((_, v) => v !== null)
  @IsUrl(WEBSITE_URL_OPTIONS, { message: 'Website must be a full http(s) link' })
  @MaxLength(200)
  website?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @NormalizeSocialLinks()
  @IsSocialLinks()
  socialLinks?: SocialLinks;
}

export const PUBLIC_COLLECTION_SORTS = ['value_desc', 'value_asc', 'newest', 'name'] as const;

export class PublicCollectionQueryDto extends CursorQueryDto {
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

  @ApiPropertyOptional({ enum: PUBLIC_COLLECTION_SORTS })
  @IsOptional()
  @IsIn(PUBLIC_COLLECTION_SORTS)
  sort?: (typeof PUBLIC_COLLECTION_SORTS)[number];

  @ApiPropertyOptional({ enum: ['trade', 'sale'], description: 'only cards for trade / for sale (default: both)' })
  @IsOptional()
  @IsIn(['trade', 'sale'])
  availability?: 'trade' | 'sale';
}
