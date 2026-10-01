import { Body, Controller, Get, Header, HttpCode, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { AuthResponse, AuthTokens, LoginResponse } from '@card-trader/shared';
import { Public } from '../../common/auth/decorators';
import { AppException } from '../../common/errors/app.exception';
import { verifyEmailPage } from '../mail/templates';
import { AuthService } from './auth.service';
import { AppleSignInDto, GoogleSignInDto, LoginDto, RefreshDto, RegisterDto, TwoFactorVerifyDto, VerifyEmailDto } from './dto/auth.dto';
import { EmailVerificationService } from './email-verification.service';

/** Opens the app after verifying in the browser. */
const APP_LINK = 'cardtrader://';

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

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

  /** The link in the verification email: a friendly page, no app or sign-in needed. */
  @Get('verify-email')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async verifyEmailLink(@Query('token') token: string | undefined, @Res({ passthrough: true }) res: Response): Promise<string> {
    try {
      if (typeof token !== 'string' || token.length < 20 || token.length > 200) throw new Error('missing token');
      const outcome = await this.emailVerification.verify(token);
      return verifyEmailPage(
        true,
        outcome === 'VERIFIED' ? 'Thanks! Your email address is confirmed. You can go back to the app.' : 'Your email address was already confirmed.',
        APP_LINK,
      );
    } catch (error) {
      res.status(400);
      const message = error instanceof AppException ? (error.getResponse() as { message: string }).message : 'This verification link is invalid or has expired. Request a new one from the app.';
      return verifyEmailPage(false, message, APP_LINK);
    }
  }

  /** Same as the link, for clients that pass the token themselves. */
  @Post('verify-email')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ verified: true }> {
    await this.emailVerification.verify(dto.token);
    return { verified: true };
  }
}
