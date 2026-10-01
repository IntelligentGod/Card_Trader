import { Body, Controller, createParamDecorator, ExecutionContext, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  isValidPublicId,
  type AdminAnalytics,
  type AdminAuditEntry,
  type AdminBroadcastResponse,
  type AdminCardDetail,
  type AdminCardListItem,
  type AdminOverview,
  type AdminTradeDetail,
  type AdminTradeListItem,
  type AdminUserDetail,
  type AdminUserListItem,
  type AdminUserReviews,
  type CollectionItemResponse,
  type Paginated,
} from '@card-trader/shared';
import type { AuthUser } from '../../common/auth/auth-user';
import { AdminOnly, SuperAdminOnly } from '../../common/auth/decorators';
import { Errors } from '../../common/errors/app.exception';
import { CursorQueryDto } from '../../common/pagination/pagination';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminBroadcastService } from './admin-broadcast.service';
import { AdminCardsService } from './admin-cards.service';
import { AdminUsersService, type AdminContext } from './admin-users.service';
import { AdminService } from './admin.service';
import {
  AdminAuditQueryDto,
  AdminBlockDto,
  AdminBroadcastDto,
  AdminCardListQueryDto,
  AdminChangeRoleDto,
  AdminCreateAdminDto,
  AdminResetPasswordDto,
  AdminTradeListQueryDto,
  AdminUpdateCardDto,
  AdminUpdateUserDto,
  AdminUpdateVendorDto,
  AdminUserListQueryDto,
} from './dto/admin.dto';

/** The signed-in admin plus the request IP, for permission checks and the audit log. */
const Admin = createParamDecorator((_data: unknown, ctx: ExecutionContext): AdminContext => {
  const request = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
  if (!request.user) throw Errors.unauthorized('AUTH_REQUIRED');
  return { userId: request.user.userId, role: request.user.role, ipAddress: request.ip ?? null };
});

/**
 * Admin console. Every route requires ADMIN or SUPER_ADMIN (RolesGuard);
 * managing admins, the full audit log and announcements require SUPER_ADMIN.
 * Normal admins never see the super admin: lookups answer 404.
 */
@ApiTags('admin')
@ApiBearerAuth()
@AdminOnly()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly accounts: AdminUsersService,
    private readonly stats: AdminAnalyticsService,
    private readonly audit: AdminAuditService,
    private readonly broadcasts: AdminBroadcastService,
  ) {}

  @Get('overview')
  overview(@Admin() ctx: AdminContext): Promise<AdminOverview> {
    return this.admin.overview(ctx);
  }

  @Get('analytics')
  analytics(@Admin() ctx: AdminContext): Promise<AdminAnalytics> {
    return this.stats.analytics(ctx);
  }

  @Get('users')
  users(@Admin() ctx: AdminContext, @Query() query: AdminUserListQueryDto): Promise<Paginated<AdminUserListItem>> {
    return this.admin.listUsers(ctx, query);
  }

  @Get('users/:publicId')
  user(@Admin() ctx: AdminContext, @Param('publicId') publicId: string): Promise<AdminUserDetail> {
    return this.admin.getUser(ctx, requirePublicId(publicId));
  }

  @Patch('users/:publicId')
  updateUser(@Admin() ctx: AdminContext, @Param('publicId') publicId: string, @Body() dto: AdminUpdateUserDto): Promise<AdminUserDetail> {
    return this.accounts.update(ctx, requirePublicId(publicId), dto);
  }

  @Patch('users/:publicId/vendor')
  updateVendor(@Admin() ctx: AdminContext, @Param('publicId') publicId: string, @Body() dto: AdminUpdateVendorDto): Promise<AdminUserDetail> {
    return this.accounts.updateVendor(ctx, requirePublicId(publicId), dto);
  }

  @Patch('users/:publicId/role')
  @SuperAdminOnly()
  changeRole(@Admin() ctx: AdminContext, @Param('publicId') publicId: string, @Body() dto: AdminChangeRoleDto): Promise<AdminUserDetail> {
    return this.accounts.changeRole(ctx, requirePublicId(publicId), dto);
  }

  @Post('users/:publicId/reset-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  resetPassword(@Admin() ctx: AdminContext, @Param('publicId') publicId: string, @Body() dto: AdminResetPasswordDto): Promise<AdminUserDetail> {
    return this.accounts.resetPassword(ctx, requirePublicId(publicId), dto);
  }

  @Post('users/:publicId/block')
  @HttpCode(200)
  block(@Admin() ctx: AdminContext, @Param('publicId') publicId: string, @Body() dto: AdminBlockDto): Promise<AdminUserDetail> {
    return this.accounts.block(ctx, requirePublicId(publicId), dto);
  }

  @Post('users/:publicId/unblock')
  @HttpCode(200)
  unblock(@Admin() ctx: AdminContext, @Param('publicId') publicId: string, @Body() dto: AdminBlockDto): Promise<AdminUserDetail> {
    return this.accounts.unblock(ctx, requirePublicId(publicId), dto);
  }

  @Get('users/:publicId/history')
  userHistory(@Admin() ctx: AdminContext, @Param('publicId') publicId: string): Promise<AdminAuditEntry[]> {
    return this.accounts.history(ctx, requirePublicId(publicId));
  }

  @Get('users/:publicId/collection')
  userCollection(
    @Admin() ctx: AdminContext,
    @Param('publicId') publicId: string,
    @Query() query: CursorQueryDto,
  ): Promise<Paginated<CollectionItemResponse>> {
    return this.admin.userCollection(ctx, requirePublicId(publicId), query);
  }

  @Get('users/:publicId/trades')
  userTrades(@Admin() ctx: AdminContext, @Param('publicId') publicId: string, @Query() query: CursorQueryDto): Promise<Paginated<AdminTradeListItem>> {
    return this.admin.userTrades(ctx, requirePublicId(publicId), query);
  }

  @Get('users/:publicId/reviews')
  userReviews(@Admin() ctx: AdminContext, @Param('publicId') publicId: string): Promise<AdminUserReviews> {
    return this.admin.userReviews(ctx, requirePublicId(publicId));
  }

  @Post('admins')
  @SuperAdminOnly()
  createAdmin(@Admin() ctx: AdminContext, @Body() dto: AdminCreateAdminDto): Promise<AdminUserDetail> {
    return this.accounts.createAdmin(ctx, dto);
  }

  @Get('audit')
  @SuperAdminOnly()
  auditLog(@Admin() ctx: AdminContext, @Query() query: AdminAuditQueryDto): Promise<Paginated<AdminAuditEntry>> {
    return this.audit.list(ctx, query);
  }

  @Post('notifications/broadcast')
  @SuperAdminOnly()
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  broadcast(@Admin() ctx: AdminContext, @Body() dto: AdminBroadcastDto): Promise<AdminBroadcastResponse> {
    return this.broadcasts.broadcast(ctx, dto);
  }

  @Get('trades')
  trades(@Query() query: AdminTradeListQueryDto): Promise<Paginated<AdminTradeListItem>> {
    return this.admin.listTrades(query);
  }

  @Get('trades/:id')
  trade(@Param('id', ParseUUIDPipe) id: string): Promise<AdminTradeDetail> {
    return this.admin.getTrade(id);
  }
}

/** The whole card catalog, including unverified user submissions. */
@ApiTags('admin')
@ApiBearerAuth()
@AdminOnly()
@Controller('admin/cards')
export class AdminCardsController {
  constructor(private readonly cards: AdminCardsService) {}

  @Get()
  list(@Query() query: AdminCardListQueryDto): Promise<Paginated<AdminCardListItem>> {
    return this.cards.list(query);
  }

  @Get(':id')
  get(@Admin() ctx: AdminContext, @Param('id', ParseUUIDPipe) id: string): Promise<AdminCardDetail> {
    return this.cards.get(ctx, id);
  }

  @Patch(':id')
  update(@Admin() ctx: AdminContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminUpdateCardDto): Promise<AdminCardDetail> {
    return this.cards.update(ctx, id, dto);
  }
}

function requirePublicId(publicId: string): string {
  if (!isValidPublicId(publicId)) throw Errors.notFound('USER_NOT_FOUND', 'User not found');
  return publicId;
}
