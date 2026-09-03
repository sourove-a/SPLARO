import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import type { Request } from 'express'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import { MarketingService } from './marketing.service'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import {
  AudienceEstimateQueryDto,
  CAMPAIGN_STATUSES,
  CAMPAIGN_TYPES,
  CreateCampaignDto,
  UpdateCampaignDto,
} from './marketing.dto'

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

function isCampaignValue<T extends string>(
  values: readonly T[],
  value: string,
): value is T {
  return values.includes(value as T)
}

@Controller('marketing')
export class MarketingController {
  constructor(
    @Inject(MarketingService) private readonly marketingService: MarketingService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  private scopedStoreId(req: AdminRequest, requested?: string): Promise<string> {
    return resolveStoreId(this.prisma, req.adminUser?.storeId ?? requested)
  }

  /* ─── Campaigns ────────────────────────────────────────────── */

  @Get('campaigns')
  async getCampaigns(
    @Query('storeId') storeId: string,
    @Req() req: AdminRequest,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const sid = await this.scopedStoreId(req, storeId)
    const normalizedStatus = status?.toUpperCase()
    const normalizedType = type?.toUpperCase()
    if (normalizedStatus && !isCampaignValue(CAMPAIGN_STATUSES, normalizedStatus)) {
      throw new BadRequestException(`Unsupported campaign status: ${status}`)
    }
    if (normalizedType && !isCampaignValue(CAMPAIGN_TYPES, normalizedType)) {
      throw new BadRequestException(`Unsupported campaign type: ${type}`)
    }
    const parsedPage = page === undefined ? 1 : Number(page)
    const parsedLimit = limit === undefined ? 20 : Number(limit)
    if (
      !Number.isInteger(parsedPage) ||
      parsedPage < 1 ||
      !Number.isInteger(parsedLimit) ||
      parsedLimit < 1
    ) {
      throw new BadRequestException('page and limit must be positive integers.')
    }
    const take = Math.min(parsedLimit, 100)
    const skip = (parsedPage - 1) * take

    const where = {
      storeId: sid,
      ...(normalizedStatus ? { status: normalizedStatus } : {}),
      ...(normalizedType ? { type: normalizedType } : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.campaign.count({ where }),
    ])

    return { items, total, page: parsedPage, limit: take }
  }

  @Get('campaigns/stats')
  async campaignStats(@Query('storeId') storeId: string, @Req() req: AdminRequest) {
    const sid = await this.scopedStoreId(req, storeId)
    const [byStatus, byType, totals] = await Promise.all([
      this.prisma.campaign.groupBy({
        by: ['status'],
        where: { storeId: sid },
        _count: true,
      }),
      this.prisma.campaign.groupBy({
        by: ['type'],
        where: { storeId: sid },
        _count: true,
      }),
      this.prisma.campaign.aggregate({
        where: { storeId: sid, status: 'SENT' },
        _sum: { totalSent: true, totalDelivered: true, totalOpened: true, totalClicked: true },
      }),
    ])

    const sent = totals._sum.totalSent ?? 0
    const opened = totals._sum.totalOpened ?? 0
    const clicked = totals._sum.totalClicked ?? 0

    return {
      byStatus,
      byType,
      totalSent: sent,
      totalOpened: opened,
      totalClicked: clicked,
      openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
      clickRate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
    }
  }

  @Get('campaigns/audience-estimate')
  async audienceEstimate(
    @Query('storeId') storeId: string,
    @Query() query: AudienceEstimateQueryDto,
    @Req() req: AdminRequest,
  ) {
    const sid = await this.scopedStoreId(req, storeId)
    return this.marketingService.getAudienceEstimate(sid, query)
  }

  @Get('campaigns/:id/recipients')
  async getCampaignRecipients(
    @Param('id') id: string,
    @Query('storeId') storeId: string,
    @Req() req: AdminRequest,
  ) {
    const sid = await this.scopedStoreId(req, storeId)
    return this.marketingService.getCampaignRecipients(id, sid)
  }

  @Get('campaigns/:id')
  async getCampaign(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.marketingService.getCampaign(id, await this.scopedStoreId(req))
  }

  @Post('campaigns')
  async createCampaign(
    @Query('storeId') storeId: string,
    @Body() body: CreateCampaignDto,
    @Req() req: AdminRequest,
  ) {
    const sid = await this.scopedStoreId(req, body.storeId ?? storeId)
    return this.marketingService.createCampaign({
      ...body,
      storeId: sid,
      targetAudience: body.targetAudience ?? 'ALL',
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
    })
  }

  @Patch('campaigns/:id')
  async updateCampaign(
    @Param('id') id: string,
    @Body() body: UpdateCampaignDto,
    @Query('storeId') storeId: string,
    @Req() req: AdminRequest,
  ) {
    return this.marketingService.updateCampaign(id, body, await this.scopedStoreId(req, storeId))
  }

  @Delete('campaigns/:id')
  async deleteCampaign(
    @Param('id') id: string,
    @Query('storeId') storeId: string,
    @Req() req: AdminRequest,
  ) {
    return this.marketingService.deleteCampaign(id, await this.scopedStoreId(req, storeId))
  }

  @Post('campaigns/:id/send')
  async sendCampaign(
    @Param('id') id: string,
    @Query('storeId') storeId: string,
    @Req() req: AdminRequest,
  ) {
    return this.marketingService.sendCampaignNow(id, await this.scopedStoreId(req, storeId))
  }

  @Post('campaigns/:id/duplicate')
  async duplicateCampaign(
    @Param('id') id: string,
    @Query('storeId') storeId: string,
    @Req() req: AdminRequest,
  ) {
    return this.marketingService.duplicateCampaign(id, await this.scopedStoreId(req, storeId))
  }

  /* ─── Newsletter subscribers ───────────────────────────────── */

  @Get('subscribers')
  async subscribers(
    @Query('storeId') storeId: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const take = Math.min(Number(limit) || 30, 100)
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take

    const where = {
      storeId: sid,
      ...(status ? { status } : {}),
      ...(search ? { email: { contains: search, mode: 'insensitive' as const } } : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.newsletterSubscriber.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.newsletterSubscriber.count({ where }),
    ])

    return { items, total, page: Number(page) || 1, limit: take }
  }

  @Delete('subscribers/:id')
  async unsubscribe(@Param('id') id: string) {
    await this.prisma.newsletterSubscriber.update({
      where: { id },
      data: { status: 'unsubscribed' },
    })
    return { ok: true }
  }

  @Delete('subscribers/:id/hard')
  async deleteSubscriber(@Param('id') id: string) {
    await this.prisma.newsletterSubscriber.delete({ where: { id } })
    return { deleted: id }
  }

  /* ─── Abandoned cart ───────────────────────────────────────── */

  @Post('abandoned-cart/trigger')
  triggerAbandonedCart(@Body('storeId') storeId: string) {
    return this.marketingService.triggerAbandonedCartFlow(storeId)
  }

  /* ─── AI copy ──────────────────────────────────────────────── */

  @Post('ai-copy')
  generateCopy(@Body() body: Parameters<MarketingService['generateCampaignCopy']>[0]) {
    return this.marketingService.generateCampaignCopy(body)
  }

  /* ─── Web push ─────────────────────────────────────────────── */

  @Post('push/broadcast')
  broadcastPush(@Body() body: { storeId: string; title: string; body: string; url?: string }) {
    return this.marketingService.sendBroadcastPush(body.storeId, body.title, body.body, body.url)
  }

  @Post('push/customer/:customerId')
  customerPush(
    @Param('customerId') customerId: string,
    @Body() body: { title: string; body: string; url?: string },
  ) {
    return this.marketingService.sendWebPush(customerId, body.title, body.body, body.url)
  }

  @Get('push/subscribers')
  async pushSubscribers(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.prisma.webPushToken.findMany({
      where: { storeId: sid },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }
}
