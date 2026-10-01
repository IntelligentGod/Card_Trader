import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { MeResponse, PublicProfile, QrPayload } from '@card-trader/shared';
import type { AuthUser } from '../../common/auth/auth-user';
import { AllowWhilePasswordChangeRequired, CurrentUser } from '../../common/auth/decorators';
import { UpdateMeDto, UpsertVendorProfileDto } from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Reachable during a pending password change so the app can show that screen. */
  @Get('me')
  @AllowWhilePasswordChangeRequired()
  getMe(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return this.users.getMe(user.userId);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto): Promise<MeResponse> {
    return this.users.updateMe(user.userId, dto);
  }

  /** Vendor Mode: same account, inventory, reviews and history. isActive=false switches it off. */
  @Put('me/vendor')
  upsertVendor(@CurrentUser() user: AuthUser, @Body() dto: UpsertVendorProfileDto): Promise<MeResponse> {
    return this.users.upsertVendor(user.userId, dto);
  }

  @Get('me/qr')
  getQr(@CurrentUser() user: AuthUser): Promise<QrPayload> {
    return this.users.getQr(user.userId);
  }

  /** Resolves a scanned QR / shared link. Rate-limited to make public-id probing pointless. */
  @Get(':publicId')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getPublicProfile(@Param('publicId') publicId: string): Promise<PublicProfile> {
    return this.users.getPublicProfile(publicId);
  }
}
