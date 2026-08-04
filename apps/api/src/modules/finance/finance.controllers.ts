import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { Request } from 'express'
import { Public } from '../../common/auth/public.decorator'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import {
  canManagePartnerEquity,
  canManagePartnerRoster,
} from '../security/security-permissions.util'
import { PartnersService, PartnerTransactionsService } from './partners.service'

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

function assertPartnerRoster(req: AdminRequest) {
  if (!canManagePartnerRoster(req.adminUser?.role)) {
    throw new ForbiddenException('Only Owner or Admin can manage the partner roster')
  }
}

function assertPartnerEquity(req: AdminRequest) {
  if (!canManagePartnerEquity(req.adminUser?.role)) {
    throw new ForbiddenException('Only Owner can change equity share percentages')
  }
}

@Controller('partners')
export class PartnersController {
  constructor(private readonly partners: PartnersService) {}

  @Get()
  list(@Query('storeId') storeId: string) {
    return this.partners.list(storeId)
  }

  @Post()
  create(
    @Req() req: AdminRequest,
    @Query('storeId') storeId: string,
    @Body()
    body: {
      name: string
      slug?: string
      email: string
      phone?: string
      sharePercent: number
      notes?: string
      createdBy?: string
    },
  ) {
    assertPartnerRoster(req)
    return this.partners.create(storeId, body)
  }

  /** @deprecated Use POST /partners — partners are added manually in admin */
  @Post('seed')
  seed(@Req() req: AdminRequest, @Query('storeId') storeId: string) {
    assertPartnerRoster(req)
    return this.partners.list(storeId)
  }

  @Post(':slug/resend-invite')
  resendInvite(
    @Req() req: AdminRequest,
    @Query('storeId') storeId: string,
    @Param('slug') slug: string,
  ) {
    assertPartnerRoster(req)
    return this.partners.resendInvite(storeId, slug)
  }

  @Get(':slug')
  getBySlug(@Query('storeId') storeId: string, @Param('slug') slug: string) {
    return this.partners.getBySlug(storeId, slug)
  }

  @Get(':slug/summary')
  monthlySummary(
    @Query('storeId') storeId: string,
    @Param('slug') slug: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.partners.getBySlug(storeId, slug).then((p) =>
      this.partners.getMonthlySummary(storeId, p.id, Number(year), Number(month)),
    )
  }

  @Patch('share-settings')
  updateShares(
    @Req() req: AdminRequest,
    @Query('storeId') storeId: string,
    @Body() body: { shares: { partnerId: string; sharePercent: number }[]; createdBy?: string },
  ) {
    assertPartnerEquity(req)
    return this.partners.updateSharePercentages(storeId, body.shares, body.createdBy)
  }

  @Patch(':slug')
  updateProfile(
    @Query('storeId') storeId: string,
    @Param('slug') slug: string,
    @Body()
    body: {
      name?: string
      email?: string
      phone?: string
      avatarUrl?: string
      notes?: string
    },
  ) {
    return this.partners.updateProfile(storeId, slug, body)
  }
}

/** Public invite preview + confirm — no admin session. */
@Controller('partner-invites')
export class PartnerInvitesController {
  constructor(private readonly partners: PartnersService) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':token')
  preview(@Param('token') token: string) {
    return this.partners.previewInvite(token)
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':token/confirm')
  confirm(@Param('token') token: string) {
    return this.partners.confirmInvite(token)
  }
}

@Controller('partner-transactions')
export class PartnerTransactionsController {
  constructor(private readonly transactions: PartnerTransactionsService) {}

  @Get()
  list(
    @Query('storeId') storeId: string,
    @Query('partnerId') partnerId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.transactions.list(storeId, {
      partnerId,
      type: type as never,
      status: status as never,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      search,
    })
  }

  @Post()
  create(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      partnerId: string
      type: string
      amount: number
      transactionDate?: string
      note?: string
      attachmentUrl?: string
      orderId?: string
      createdBy?: string
    },
  ) {
    return this.transactions.create(storeId, { ...body, type: body.type as never })
  }

  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @Query('storeId') storeId: string,
    @Body() body: { approvedBy?: string },
  ) {
    return this.transactions.approve(id, storeId, body.approvedBy)
  }

  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Query('storeId') storeId: string,
    @Body() body: { reason: string; rejectedBy?: string },
  ) {
    return this.transactions.reject(id, storeId, body.reason, body.rejectedBy)
  }
}
