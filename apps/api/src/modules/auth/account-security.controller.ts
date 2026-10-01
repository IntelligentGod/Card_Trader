import { Body, Controller, Delete, HttpCode, Param, ParseEnumPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthResponse, MeResponse, RecoveryCodesResponse, TwoFactorSetupResponse } from '@card-trader/shared';
import type { AuthUser } from '../../common/auth/auth-user';
import { AllowWhilePasswordChangeRequired, CurrentUser } from '../../common/auth/decorators';
import { AuthService } from './auth.service';
import { AppleSignInDto, ChangePasswordDto, GoogleSignInDto, TwoFactorCodeDto, TwoFactorProofDto } from './dto/auth.dto';
import { TwoFactorService } from './two-factor.service';

/** Security settings of the signed-in account. */
@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AccountSecurityController {
  constructor(
    private readonly auth: AuthService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  /** Also the way out of an admin password reset, so it stays reachable then. */
  @Post('change-password')
  @HttpCode(200)
  @AllowWhilePasswordChangeRequired()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto): Promise<AuthResponse> {
    return this.auth.changePassword(user.userId, dto);
  }

  @Post('2fa/setup')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  setupTwoFactor(@CurrentUser() user: AuthUser): Promise<TwoFactorSetupResponse> {
    return this.twoFactor.beginSetup(user.userId);
  }

  @Post('2fa/enable')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  enableTwoFactor(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorCodeDto): Promise<RecoveryCodesResponse> {
    return this.twoFactor.enable(user.userId, dto.code);
  }

  @Post('2fa/disable')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async disableTwoFactor(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorProofDto): Promise<void> {
    await this.twoFactor.disable(user.userId, dto);
  }

  @Post('2fa/recovery-codes')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  regenerateRecoveryCodes(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorProofDto): Promise<RecoveryCodesResponse> {
    return this.twoFactor.regenerateRecoveryCodes(user.userId, dto);
  }

  @Post('providers/google')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async linkGoogle(@CurrentUser() user: AuthUser, @Body() dto: GoogleSignInDto): Promise<MeResponse> {
    return this.auth.linkProvider(user.userId, await this.auth.verifyGoogle(dto.idToken));
  }

  @Post('providers/apple')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async linkApple(@CurrentUser() user: AuthUser, @Body() dto: AppleSignInDto): Promise<MeResponse> {
    return this.auth.linkProvider(user.userId, await this.auth.verifyApple(dto.identityToken, dto.nonce));
  }

  @Delete('providers/:provider')
  unlink(
    @CurrentUser() user: AuthUser,
    @Param('provider', new ParseEnumPipe({ google: 'GOOGLE', apple: 'APPLE' })) provider: 'GOOGLE' | 'APPLE',
  ): Promise<MeResponse> {
    return this.auth.unlinkProvider(user.userId, provider);
  }
}
