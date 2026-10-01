import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  EventDetail,
  EventInventorySelection,
  EventSearchResult,
  EventSummary,
  EventVendorResponse,
  Paginated,
} from '@card-trader/shared';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import {
  ApplyAsVendorDto,
  ApproveVendorDto,
  CreateEventDto,
  EventListQueryDto,
  EventSearchQueryDto,
  SetEventInventoryDto,
  UpdateEventDto,
} from './dto/events.dto';
import { EventsService } from './events.service';

const uuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  // ── Browse ──
  @Get()
  @ApiOperation({ summary: 'Upcoming shows, shows I organize, or shows I saved / vend at' })
  list(@CurrentUser() user: AuthUser, @Query() query: EventListQueryDto): Promise<Paginated<EventSummary>> {
    return this.events.list(user.userId, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<EventDetail> {
    return this.events.get(user.userId, id);
  }

  // ── Organizer ──
  @Post()
  @ApiOperation({ summary: 'Create a draft event (you become its organizer)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEventDto): Promise<EventDetail> {
    return this.events.create(user.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() dto: UpdateEventDto): Promise<EventDetail> {
    return this.events.update(user.userId, id, dto);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<EventDetail> {
    return this.events.publish(user.userId, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<EventDetail> {
    return this.events.cancel(user.userId, id);
  }

  @Get(':id/vendors')
  @ApiOperation({ summary: 'Organizer: every vendor application' })
  applications(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<EventVendorResponse[]> {
    return this.events.listApplications(user.userId, id);
  }

  @Post(':id/vendors/:applicationId/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Organizer: approve a vendor (or change their table)' })
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Param('applicationId', uuid) applicationId: string,
    @Body() dto: ApproveVendorDto,
  ): Promise<EventVendorResponse> {
    return this.events.approve(user.userId, id, applicationId, dto);
  }

  @Post(':id/vendors/:applicationId/decline')
  @HttpCode(200)
  decline(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Param('applicationId', uuid) applicationId: string,
  ): Promise<EventVendorResponse> {
    return this.events.decline(user.userId, id, applicationId);
  }

  // ── Attendees ──
  @Put(':id/save')
  save(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<EventDetail> {
    return this.events.setSaved(user.userId, id, true);
  }

  @Delete(':id/save')
  unsave(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<EventDetail> {
    return this.events.setSaved(user.userId, id, false);
  }

  @Get(':id/search')
  @ApiOperation({ summary: 'Search This Event: inventory across all approved vendors' })
  search(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Query() query: EventSearchQueryDto,
  ): Promise<Paginated<EventSearchResult>> {
    return this.events.search(user.userId, id, query);
  }

  // ── Vendor ──
  @Post(':id/vendors/apply')
  @HttpCode(200)
  @ApiOperation({ summary: 'Join as Vendor (requires Vendor Mode)' })
  apply(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() dto: ApplyAsVendorDto): Promise<EventDetail> {
    return this.events.apply(user.userId, id, dto);
  }

  @Delete(':id/vendors/me')
  withdraw(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<EventDetail> {
    return this.events.withdraw(user.userId, id);
  }

  @Get(':id/inventory/me')
  myInventory(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<EventInventorySelection> {
    return this.events.getMyInventory(user.userId, id);
  }

  @Put(':id/inventory/me')
  @ApiOperation({ summary: 'Approved vendor: set the cards "Bringing to this event"' })
  setMyInventory(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: SetEventInventoryDto,
  ): Promise<EventInventorySelection> {
    return this.events.setMyInventory(user.userId, id, dto);
  }
}
