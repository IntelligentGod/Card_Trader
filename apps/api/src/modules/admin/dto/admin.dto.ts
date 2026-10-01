import { ApiProperty, ApiPropertyOptional, IntersectionType, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  CARD_CATEGORIES,
  CatalogSource,
  TRADE_STATUSES,
  USERNAME_PATTERN,
  UserRole,
  UserStatus,
  type AdminAuditQuery,
  type AdminBlockRequest,
  type AdminBroadcastRequest,
  type AdminCardListQuery,
  type AdminChangeRoleRequest,
  type AdminCreateAdminRequest,
  type AdminResetPasswordRequest,
  type AdminTargetType,
  type AdminTradeListQuery,
  type AdminUpdateCardRequest,
  type AdminUpdateUserRequest,
  type AdminUpdateVendorRequest,
  type AdminUserListQuery,
  type CardCategory,
  type TradeStatus,
} from '@card-trader/shared';
import { CursorQueryDto } from '../../../common/pagination/pagination';
import { LowercaseEmail, SanitizedText } from '../../../common/validation/transforms';
import { DISPLAY_NAME_PATTERN, NormalizeUsername, PASSWORD_MAX, PASSWORD_MIN, USERNAME_MESSAGE } from '../../auth/dto/auth.dto';
import { UpdateMeDto, UpsertVendorProfileDto, WEBSITE_URL_OPTIONS } from '../../users/dto/users.dto';

const USER_ROLES = Object.values(UserRole);
const USER_STATUSES = Object.values(UserStatus);

export class AdminUserListQueryDto extends CursorQueryDto implements AdminUserListQuery {
  @ApiPropertyOptional({ maxLength: 254, description: 'email, username or display name' })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @MaxLength(254)
  q?: string;

  @ApiPropertyOptional({ enum: USER_ROLES })
  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;

  @ApiPropertyOptional({ enum: USER_STATUSES })
  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: UserStatus;
}

export class AdminTradeListQueryDto extends CursorQueryDto implements AdminTradeListQuery {
  @ApiPropertyOptional({ enum: TRADE_STATUSES })
  @IsOptional()
  @IsIn(TRADE_STATUSES)
  status?: TradeStatus;
}

/** Free-text reason stored in the audit log. */
class ReasonDto {
  @ApiPropertyOptional({ maxLength: 500, nullable: true, description: 'stored in the audit log' })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

/** Same rules as a user editing their own profile, plus email and photo removal. Status: use block/unblock. */
export class AdminUpdateUserDto extends IntersectionType(OmitType(UpdateMeDto, ['avatarKey'] as const), ReasonDto) implements AdminUpdateUserRequest {
  @ApiPropertyOptional({ maxLength: 254 })
  @IsOptional()
  @LowercaseEmail()
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ description: 'true deletes the profile photo' })
  @IsOptional()
  @IsBoolean()
  removeAvatar?: boolean;
}

export class AdminChangeRoleDto extends ReasonDto implements AdminChangeRoleRequest {
  /** SUPER_ADMIN is deliberately not accepted: it can only be granted from the server command line. */
  @ApiProperty({ enum: ['USER', 'ADMIN'] })
  @IsIn(['USER', 'ADMIN'], { message: 'Role must be USER or ADMIN' })
  role: 'USER' | 'ADMIN';
}

export class AdminResetPasswordDto extends ReasonDto implements AdminResetPasswordRequest {
  @ApiProperty({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX })
  @IsString()
  @MinLength(PASSWORD_MIN, { message: `Password must be at least ${PASSWORD_MIN} characters` })
  @MaxLength(PASSWORD_MAX)
  newPassword: string;

  @ApiPropertyOptional({ default: true, description: 'the user must choose a new password at next sign-in' })
  @IsOptional()
  @IsBoolean()
  requireChange?: boolean;
}

export class AdminBlockDto extends ReasonDto implements AdminBlockRequest {}

export class AdminCreateAdminDto implements AdminCreateAdminRequest {
  @ApiProperty({ maxLength: 254 })
  @LowercaseEmail()
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email: string;

  @ApiProperty({ pattern: USERNAME_PATTERN.source })
  @NormalizeUsername()
  @IsString()
  @Matches(USERNAME_PATTERN, { message: USERNAME_MESSAGE })
  username: string;

  @ApiProperty({ minLength: 2, maxLength: 40 })
  @SanitizedText()
  @IsString()
  @Length(2, 40)
  @Matches(DISPLAY_NAME_PATTERN, { message: 'Display name contains unsupported characters' })
  displayName: string;

  @ApiProperty({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX })
  @IsString()
  @MinLength(PASSWORD_MIN, { message: `Password must be at least ${PASSWORD_MIN} characters` })
  @MaxLength(PASSWORD_MAX)
  temporaryPassword: string;
}

export class AdminBroadcastDto implements AdminBroadcastRequest {
  @ApiProperty({ minLength: 3, maxLength: 120 })
  @SanitizedText()
  @IsString()
  @Length(3, 120)
  title: string;

  @ApiProperty({ minLength: 3, maxLength: 300 })
  @SanitizedText()
  @IsString()
  @Length(3, 300)
  message: string;
}

export class AdminAuditQueryDto extends CursorQueryDto implements AdminAuditQuery {
  @ApiPropertyOptional({ example: 'USER_PASSWORD_RESET' })
  @IsOptional()
  @Matches(/^[A-Z_]{3,40}$/, { message: 'Invalid action' })
  action?: string;

  @ApiPropertyOptional({ enum: ['USER', 'CARD', 'SYSTEM'] })
  @IsOptional()
  @IsIn(['USER', 'CARD', 'SYSTEM'])
  targetType?: AdminTargetType;
}

/** Same rules as a vendor editing their own profile; every field optional, logo can only be removed. */
export class AdminUpdateVendorDto
  extends PartialType(OmitType(UpsertVendorProfileDto, ['logoKey'] as const))
  implements AdminUpdateVendorRequest
{
  @ApiPropertyOptional({ description: 'true deletes the vendor logo' })
  @IsOptional()
  @IsBoolean()
  removeLogo?: boolean;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

const toOptionalBool = ({ value }: { value: unknown }) =>
  value === 'true' || value === true ? true : value === 'false' || value === false ? false : value;
const CATALOG_SOURCES = Object.values(CatalogSource);

export class AdminCardListQueryDto extends CursorQueryDto implements AdminCardListQuery {
  @ApiPropertyOptional({ maxLength: 120, description: 'name, number, subject or set name' })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ enum: CARD_CATEGORIES })
  @IsOptional()
  @IsIn(CARD_CATEGORIES)
  category?: CardCategory;

  @ApiPropertyOptional({ enum: CATALOG_SOURCES })
  @IsOptional()
  @IsIn(CATALOG_SOURCES)
  source?: CatalogSource;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(toOptionalBool)
  @IsBoolean()
  verified?: boolean;
}

export class AdminUpdateCardDto implements AdminUpdateCardRequest {
  @ApiPropertyOptional({ minLength: 1, maxLength: 120 })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @Length(1, 120)
  name?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 32 })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @Length(1, 32)
  cardNumber?: string;

  @ApiPropertyOptional({ maxLength: 80, description: '"" is the base card' })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @MaxLength(80)
  variant?: string;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(120)
  subject?: string | null;

  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(40)
  rarity?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf((_, v) => v !== null)
  @IsUrl(WEBSITE_URL_OPTIONS, { message: 'Image URL must be a full http(s) link' })
  @MaxLength(500)
  imageUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}
