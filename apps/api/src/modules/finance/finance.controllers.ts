import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
} from '@nestjs/common'
import { PartnersService, PartnerTransactionsService } from './partners.service'

@Controller('partners')
export class PartnersController {
  constructor(private readonly partners: PartnersService) {}

  @Get()
  list(@Query('storeId') storeId: string) {
    return this.partners.list(storeId)
  }

  @Post('seed')
  seed(@Query('storeId') storeId: string, @Body() body: { createdBy?: string }) {
    return this.partners.ensureDefaultPartners(storeId, body.createdBy)
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
    @Query('storeId') storeId: string,
    @Body() body: { shares: { partnerId: string; sharePercent: number }[]; createdBy?: string },
  ) {
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
