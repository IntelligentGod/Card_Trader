import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import {
  USERNAME_PATTERN,
  type AppleSignInRequest,
  type ChangePasswordRequest,
  type GoogleSignInRequest,
  type LoginRequest,
  type RefreshRequest,
  type RegisterRequest,
  type TwoFactorCodeRequest,
  type TwoFactorProofRequest,
  type TwoFactorVerifyRequest,
} from '@card-trader/shared';
import { LowercaseEmail, SanitizedText } from '../../../common/validation/transforms';

export const DISPLAY_NAME_PATTERN = /^[\p{L}\p{N} ._'-]+$/u;
export const USERNAME_MESSAGE = 'Username must be 3–20 letters, numbers or underscores';

/** Usernames are case-insensitive: stored lowercase, a leading "@" is ignored. */
export function NormalizeUsername() {
  return Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/^@/, '').toLowerCase() : value));
}

export class RegisterDto implements RegisterRequest {
  @ApiProperty({ example: 'tom@example.com' })
  @LowercaseEmail()
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email: string;

  @ApiProperty({ minLength: 10, maxLength: 128 })
  @IsString()
  @MinLength(10, { message: 'Password must be at least 10 characters' })
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: 'tom_cards', pattern: USERNAME_PATTERN.source })
  @NormalizeUsername()
  @IsString()
  @Matches(USERNAME_PATTERN, { message: USERNAME_MESSAGE })
  username: string;

  @ApiProperty({ example: 'Tom', minLength: 2, maxLength: 40 })
  @SanitizedText()
  @IsString()
  @Length(2, 40)
  @Matches(DISPLAY_NAME_PATTERN, { message: 'Display name contains unsupported characters' })
  displayName: string;
}

export class LoginDto implements LoginRequest {
  @ApiProperty()
  @LowercaseEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

export class RefreshDto implements RefreshRequest {
  @ApiProperty()
  @IsString()
  @Length(20, 200)
  refreshToken: string;
}

/** Same password rules everywhere a password is set. */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

const TOTP_CODE = /^\d{6}$/;
/** Opaque tokens we issue are 43 base64url chars; provider JWTs are a few KB. */
const ID_TOKEN_MAX = 8192;

export class GoogleSignInDto implements GoogleSignInRequest {
  @ApiProperty({ description: 'ID token from Google Sign-In' })
  @IsString()
  @Length(20, ID_TOKEN_MAX)
  idToken: string;
}

class AppleNameDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @SanitizedText()
  @IsString()
  @MaxLength(40)
  givenName?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @SanitizedText()
  @IsString()
  @MaxLength(40)
  familyName?: string | null;
}

export class AppleSignInDto implements AppleSignInRequest {
  @ApiProperty({ description: 'identityToken from Sign in with Apple' })
  @IsString()
  @Length(20, ID_TOKEN_MAX)
  identityToken: string;

  @ApiProperty({ description: 'the raw nonce; its SHA-256 was sent to Apple' })
  @IsString()
  @Length(16, 128)
  nonce: string;

  @ApiPropertyOptional({ type: AppleNameDto, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @ValidateNested()
  @Type(() => AppleNameDto)
  fullName?: AppleNameDto | null;
}

export class TwoFactorVerifyDto implements TwoFactorVerifyRequest {
  @ApiProperty()
  @IsString()
  @Length(20, 200)
  challengeToken: string;

  @ApiPropertyOptional({ example: '123456' })
  @IsOptional()
  @Matches(TOTP_CODE, { message: 'Enter the 6-digit code' })
  code?: string;

  @ApiPropertyOptional({ example: 'k7m2-9qxa-4tpw' })
  @IsOptional()
  @IsString()
  @Length(8, 32)
  recoveryCode?: string;
}

export class TwoFactorCodeDto implements TwoFactorCodeRequest {
  @ApiProperty({ example: '123456' })
  @Matches(TOTP_CODE, { message: 'Enter the 6-digit code' })
  code: string;
}

export class TwoFactorProofDto implements TwoFactorProofRequest {
  @ApiPropertyOptional({ example: '123456' })
  @IsOptional()
  @Matches(TOTP_CODE, { message: 'Enter the 6-digit code' })
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(8, 32)
  recoveryCode?: string;
}

export class ChangePasswordDto implements ChangePasswordRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(PASSWORD_MAX)
  currentPassword?: string;

  @ApiProperty({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX })
  @IsString()
  @MinLength(PASSWORD_MIN, { message: `Password must be at least ${PASSWORD_MIN} characters` })
  @MaxLength(PASSWORD_MAX)
  newPassword: string;
}
