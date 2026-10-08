import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { BillingStatusResponse, MeResponse } from '@card-trader/shared';
import type { AuthUser } from '../../common/auth/auth-user';
import { AllowWithoutPurchase, CurrentUser, Public } from '../../common/auth/decorators';
import { UsersService } from '../users/users.service';
import { BillingService } from './billing.service';

/** The one-time unlock: reachable before paying, by design. */
@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing')
@AllowWithoutPurchase()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly users: UsersService,
  ) {}

  @Get('status')
  status(@CurrentUser() user: AuthUser): Promise<BillingStatusResponse> {
    return this.billing.status(user.userId);
  }

  /** Called by the app after a purchase or "Restore purchases"; answers with the refreshed profile. */
  @Post('sync')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async sync(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    await this.billing.syncFromStore(user.userId, user.publicId);
    return this.users.getMe(user.userId);
  }

  /** RevenueCat server → us (purchases, refunds). Secured by the shared secret, not a user token. */
  @Post('webhooks/revenuecat')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  webhook(@Headers('authorization') authorization: string | undefined, @Body() body: unknown): Promise<{ handled: boolean }> {
    return this.billing.handleWebhook(authorization, body as Parameters<BillingService['handleWebhook']>[1]);
  }
}
