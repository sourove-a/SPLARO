import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import type { Request } from 'express'
import { Public } from '../../common/auth/public.decorator'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import { WholesaleInquiryDto } from '../../common/dtos/storefront.dto'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { AdminTelegramHubService } from '../notifications/admin-telegram-hub.service'
import { WholesaleService } from './wholesale.service'

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

@ApiTags('wholesale')
@Controller()
export class WholesaleController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wholesale: WholesaleService,
    private readonly telegramHub: AdminTelegramHubService,
  ) {}

  /**
   * Public storefront form. Rate limited because it writes a row for anyone who
   * can reach the page — the service also folds a repeat submit from the same
   * number back onto the first lead.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('storefront/wholesale-inquiry')
  async submit(@Query('storeId') storeId: string, @Body() body: WholesaleInquiryDto) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const result = await this.wholesale.submit(sid, body)

    if (!result.duplicate) {
      void this.telegramHub.notifyWholesaleInquiry(sid, {
        fullName: body.fullName,
        companyName: body.companyName,
        industry: body.industry,
        country: body.country,
        phone: body.phone,
        email: body.email,
        productInterest: body.productInterest,
        monthlyQuantity: body.monthlyQuantity,
        message: body.message,
        photoCount: Array.isArray(body.imageUrls) ? body.imageUrls.length : 0,
      })
    }

    return {
      ok: true as const,
      duplicate: result.duplicate,
      message: result.duplicate
        ? 'We already have a recent enquiry from this number. Our wholesale team will still contact you.'
        : 'Thanks — our wholesale team will contact you shortly.',
    }
  }

  @Get('admin/wholesale-inquiries')
  async list(
    @Query('storeId') storeId: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.wholesale.list(sid, {
      ...(status ? { status } : {}),
      ...(search ? { search } : {}),
      ...(page ? { page: Number(page) } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
    })
  }

  @Patch('admin/wholesale-inquiries/:id')
  async update(
    @Param('id') id: string,
    @Query('storeId') storeId: string,
    @Body() body: { status?: string; adminNotes?: string },
    @Req() req: AdminRequest,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.wholesale.update(sid, id, {
      ...(body.status ? { status: body.status } : {}),
      ...(body.adminNotes !== undefined ? { adminNotes: body.adminNotes } : {}),
      ...(req.adminUser?.userId ? { handledById: req.adminUser.userId } : {}),
    })
  }

  @Delete('admin/wholesale-inquiries/:id')
  async remove(@Param('id') id: string, @Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.wholesale.remove(sid, id)
  }

  @Public()
  @Get('storefront/wholesale-stock')
  async publicStock(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const images = await this.wholesale.listStockImages(sid, { activeOnly: true })
    return { images }
  }

  @Get('admin/wholesale-stock')
  async adminStock(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const images = await this.wholesale.listStockImages(sid, { activeOnly: false })
    return { images }
  }

  @Post('admin/wholesale-stock')
  async createStock(
    @Query('storeId') storeId: string,
    @Body() body: { url?: string; title?: string },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.wholesale.createStockImage(sid, {
      url: body.url ?? '',
      ...(body.title ? { title: body.title } : {}),
    })
  }

  @Patch('admin/wholesale-stock/:id')
  async updateStock(
    @Param('id') id: string,
    @Query('storeId') storeId: string,
    @Body() body: { title?: string | null; sortOrder?: number; isActive?: boolean },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.wholesale.updateStockImage(sid, id, body)
  }

  @Delete('admin/wholesale-stock/:id')
  async removeStock(@Param('id') id: string, @Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.wholesale.removeStockImage(sid, id)
  }
}
