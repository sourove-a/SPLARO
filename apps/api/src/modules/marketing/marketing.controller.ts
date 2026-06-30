import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { MarketingService } from './marketing.service'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'

@Controller('marketing')
export class MarketingController {
  constructor(
    @Inject(MarketingService) private readonly marketingService: MarketingService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /* ─── Campaigns ────────────────────────────────────────────── */

  @Get('campaigns')
  async getCampaigns(
    @Query('storeId') storeId: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const take = Math.min(Number(limit) || 20, 100)
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take

    const where = {
      storeId: sid,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
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

    return { items, total, page: Number(page) || 1, limit: take }
  }

  @Get('campaigns/stats')
  async campaignStats(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
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

  @Get('campaigns/:id')
  async getCampaign(@Param('id') id: string) {
    return this.prisma.campaign.findUnique({ where: { id } })
  }

  @Post('campaigns')
  async createCampaign(
    @Query('storeId') storeId: string,
    @Body() body: Omit<Parameters<MarketingService['createCampaign']>[0], 'storeId'> & { storeId?: string },
  ) {
    const sid = await resolveStoreId(this.prisma, body.storeId ?? storeId)
    return this.marketingService.createCampaign({ ...body, storeId: sid })
  }

  @Patch('campaigns/:id')
  async updateCampaign(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string
      subject?: string
      body?: string
      scheduledAt?: string
      status?: string
    },
  ) {
    return this.prisma.campaign.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.subject !== undefined ? { subject: body.subject } : {}),
        ...(body.body !== undefined ? { body: body.body } : {}),
        ...(body.scheduledAt ? { scheduledAt: new Date(body.scheduledAt) } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
    })
  }

  @Delete('campaigns/:id')
  async deleteCampaign(@Param('id') id: string) {
    await this.prisma.campaign.delete({ where: { id } })
    return { deleted: id }
  }

  @Post('campaigns/:id/send')
  sendCampaign(@Param('id') id: string) {
    return this.marketingService.sendCampaignNow(id)
  }

  @Post('campaigns/:id/duplicate')
  async duplicateCampaign(@Param('id') id: string) {
    const original = await this.prisma.campaign.findUniqueOrThrow({ where: { id } })
    const { id: _, sentAt, totalSent, totalDelivered, totalOpened, totalClicked, createdAt, updatedAt, ...rest } = original
    return this.prisma.campaign.create({
      data: { ...rest, name: `${original.name} (copy)`, status: 'DRAFT', scheduledAt: null },
    })
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
    await this.prisma.newsletterSubscriber.update({ where: { id }, data: { status: 'unsubscribed' } })
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
