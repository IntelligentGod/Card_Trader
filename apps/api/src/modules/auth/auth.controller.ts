import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthResponse, AuthTokens, LoginResponse } from '@card-trader/shared';
import { Public } from '../../common/auth/decorators';
import { AuthService } from './auth.service';
import { AppleSignInDto, GoogleSignInDto, LoginDto, RefreshDto, RegisterDto, TwoFactorVerifyDto } from './dto/auth.dto';

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.auth.register(dto);
  }

  /** Either a session, or `{ twoFactorRequired, challengeToken }` when 2FA is on. */
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.auth.login(dto);
  }

  @Post('google')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  google(@Body() dto: GoogleSignInDto): Promise<LoginResponse> {
    return this.auth.signInWithGoogle(dto.idToken);
  }

  @Post('apple')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  apple(@Body() dto: AppleSignInDto): Promise<LoginResponse> {
    return this.auth.signInWithApple(dto);
  }

  /** Second step of a 2FA sign-in. Five wrong codes also burn the challenge. */
  @Post('2fa/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyTwoFactor(@Body() dto: TwoFactorVerifyDto): Promise<AuthResponse> {
    return this.auth.completeTwoFactor(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  refresh(@Body() dto: RefreshDto): Promise<AuthTokens> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }
}
