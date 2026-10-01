import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { USERNAME_PATTERN, type LoginRequest, type RefreshRequest, type RegisterRequest } from '@card-trader/shared';
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
