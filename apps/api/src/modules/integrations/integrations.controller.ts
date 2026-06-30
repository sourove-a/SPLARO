import { Body, Controller, ForbiddenException, Get, Post, Put, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import { canWriteAdmin } from '../../common/auth/admin-session.util'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import { PrismaService } from '../../common/prisma.service'
import { AiIntegrationService, type AiIntegrationDto } from './ai-integration.service'
import { IntegrationsService } from './integrations.service'
import { TelegramIntegrationService, type TelegramIntegrationDto } from './telegram-integration.service'

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

const INTEGRATION_CATALOG: {
  id: string
  name: string
  configurePath: string
  provider: string
}[] = [
  { id: 'telegram', name: 'Telegram', configurePath: '/dashboard/telegram-bot', provider: 'telegram' },
  { id: 'openai', name: 'OpenAI', configurePath: '/dashboard/ai-agent', provider: 'openai' },
  { id: 'google_sheets', name: 'Google Sheets', configurePath: '/dashboard/automation/google-sheets-sync', provider: 'google_sheets' },
  { id: 'gmail', name: 'Gmail', configurePath: '/dashboard/all-integrations', provider: 'gmail' },
  { id: 'google_drive', name: 'Google Drive', configurePath: '/dashboard/all-integrations', provider: 'google_drive' },
  { id: 'sslcommerz', name: 'SSLCommerz', configurePath: '/dashboard/settings', provider: 'sslcommerz' },
  { id: 'bkash', name: 'bKash', configurePath: '/dashboard/settings', provider: 'bkash' },
  { id: 'nagad', name: 'Nagad', configurePath: '/dashboard/settings', provider: 'nagad' },
  { id: 'steadfast', name: 'Steadfast', configurePath: '/dashboard/courier-hub', provider: 'steadfast' },
  { id: 'pathao', name: 'Pathao', configurePath: '/dashboard/courier-hub', provider: 'pathao' },
  { id: 'redx', name: 'RedX', configurePath: '/dashboard/courier-hub', provider: 'redx' },
  { id: 'cloudflare_r2', name: 'Cloudflare R2', configurePath: '/dashboard/all-integrations', provider: 'cloudflare_r2' },
  { id: 'smtp', name: 'SMTP Email', configurePath: '/dashboard/settings', provider: 'smtp' },
  { id: 'sms', name: 'SMS Gateway', configurePath: '/dashboard/email-sms', provider: 'sms' },
  { id: 'meta_pixel', name: 'Meta Pixel', configurePath: '/dashboard/meta-business', provider: 'meta_pixel' },
  { id: 'google_analytics', name: 'Google Analytics', configurePath: '/dashboard/meta-business', provider: 'google_analytics' },
  { id: 'search_console', name: 'Search Console', configurePath: '/dashboard/seo-health', provider: 'search_console' },
]

@Controller('admin/integrations')
export class IntegrationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
    private readonly telegram: TelegramIntegrationService,
    private readonly ai: AiIntegrationService,
  ) {}

  private assertWrite(req: AdminRequest) {
    const role = req.adminUser?.role
    if (!role || !canWriteAdmin(role)) {
      throw new ForbiddenException('Insufficient permissions to modify integrations')
    }
    return req.adminUser!.userId
  }

  @Get()
  async list(@Query('storeId') storeId: string) {
    const sid = await this.integrations.resolveStore(storeId)
    const store = await this.prisma.store.findUnique({
      where: { id: sid },
      include: { settings: true, telegramConfig: true },
    })

    const [telegramCfg, aiCfg] = await Promise.all([this.telegram.get(sid), this.ai.get(sid)])

    const cards = await Promise.all(
      INTEGRATION_CATALOG.map(async (item) => {
        const meta = await this.integrations.getProviderMeta(sid, item.provider)
        let connected = false

        if (item.provider === 'telegram') {
          connected = Boolean(telegramCfg.tokenConfigured && telegramCfg.chatId && telegramCfg.isEnabled)
        } else if (item.provider === 'openai') {
          connected = Boolean(aiCfg.keyConfigured && aiCfg.isEnabled)
        } else if (item.provider === 'bkash') {
          connected = store?.settings?.bkashEnabled ?? false
        } else if (item.provider === 'nagad') {
          connected = store?.settings?.nagadEnabled ?? false
        } else if (item.provider === 'sslcommerz') {
          connected = store?.settings?.sslcommerzEnabled ?? false
        } else if (item.provider === 'meta_pixel') {
          connected = Boolean(store?.settings?.facebookPixelId)
        } else if (item.provider === 'google_analytics') {
          connected = Boolean(store?.settings?.googleAnalyticsId)
        } else if (item.provider === 'search_console') {
          connected = Boolean(store?.settings?.googleSearchConsoleKey)
        } else if (item.provider === 'smtp') {
          connected = store?.settings?.emailEnabled ?? false
        } else {
          connected = meta.lastTestStatus === 'success'
        }

        return {
          id: item.id,
          name: item.name,
          provider: item.provider,
          configurePath: item.configurePath,
          connected,
          status: connected ? 'connected' : meta.lastTestStatus === 'failed' ? 'error' : 'not_connected',
          isEnabled: meta.isEnabled,
          lastTestedAt: meta.lastTestedAt,
          lastTestStatus: meta.lastTestStatus,
          lastError: meta.lastTestStatus === 'failed' ? meta.lastTestMessage : null,
        }
      }),
    )

    return { integrations: cards }
  }

  @Get('telegram')
  getTelegram(@Query('storeId') storeId: string) {
    return this.telegram.get(storeId)
  }

  @Put('telegram')
  updateTelegram(@Query('storeId') storeId: string, @Body() body: TelegramIntegrationDto, @Req() req: AdminRequest) {
    const userId = this.assertWrite(req)
    return this.telegram.update(storeId, body, userId)
  }

  @Post('telegram/test')
  testTelegram(
    @Query('storeId') storeId: string,
    @Body() body: { message?: string },
    @Req() req: AdminRequest,
  ) {
    this.assertWrite(req)
    return this.telegram.test(storeId, req.adminUser?.userId, body.message)
  }

  @Get('ai')
  getAi(@Query('storeId') storeId: string) {
    return this.ai.get(storeId)
  }

  @Put('ai')
  updateAi(@Query('storeId') storeId: string, @Body() body: AiIntegrationDto, @Req() req: AdminRequest) {
    const userId = this.assertWrite(req)
    return this.ai.update(storeId, body, userId)
  }

  @Post('ai/test')
  testAi(@Query('storeId') storeId: string, @Body() body: AiIntegrationDto, @Req() req: AdminRequest) {
    this.assertWrite(req)
    return this.ai.test(storeId, body, req.adminUser?.userId)
  }

  /* ─── Google Sheets sync status ──────────────────────────── */

  @Get('google-sheets/status')
  async googleSheetsStatus(@Query('storeId') storeId: string) {
    const sid = await this.integrations.resolveStore(storeId)
    const [pending, failed, recent] = await Promise.all([
      this.prisma.googleSheetSync.count({ where: { storeId: sid, status: 'PENDING' } }),
      this.prisma.googleSheetSync.count({ where: { storeId: sid, status: 'FAILED' } }),
      this.prisma.googleSheetSync.findMany({
        where: { storeId: sid },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, sheetType: true, status: true, errorMsg: true, syncedAt: true, updatedAt: true },
      }),
    ])
    return { pending, failed, recent }
  }

  @Get('google-sheets/syncs')
  async googleSheetsSyncs(
    @Query('storeId') storeId: string,
    @Query('status') status?: string,
    @Query('sheetType') sheetType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const sid = await this.integrations.resolveStore(storeId)
    const take = Math.min(Number(limit) || 30, 100)
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take

    const where = {
      storeId: sid,
      ...(status ? { status: status as 'PENDING' | 'SYNCING' | 'COMPLETED' | 'FAILED' } : {}),
      ...(sheetType ? { sheetType } : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.googleSheetSync.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.googleSheetSync.count({ where }),
    ])

    return { items, total, page: Number(page) || 1, limit: take }
  }

  @Post('google-sheets/retry-failed')
  async retryFailedSyncs(@Query('storeId') storeId: string) {
    const sid = await this.integrations.resolveStore(storeId)
    const result = await this.prisma.googleSheetSync.updateMany({
      where: { storeId: sid, status: 'FAILED' },
      data: { status: 'PENDING', errorMsg: null, retryCount: { increment: 1 } },
    })
    return { queued: result.count }
  }

  /* ─── Provider health ─────────────────────────────────────── */

  @Get('health')
  async health(@Query('storeId') storeId: string) {
    const sid = await this.integrations.resolveStore(storeId)
    const [telegramCfg, aiCfg] = await Promise.all([this.telegram.get(sid), this.ai.get(sid)])

    const store = await this.prisma.store.findUnique({
      where: { id: sid },
      select: { settings: { select: { emailEnabled: true, bkashEnabled: true, nagadEnabled: true, sslcommerzEnabled: true } } },
    })

    return {
      telegram: { connected: Boolean(telegramCfg.tokenConfigured && telegramCfg.chatId && telegramCfg.isEnabled) },
      ai: { connected: Boolean(aiCfg.keyConfigured && aiCfg.isEnabled) },
      email: { connected: store?.settings?.emailEnabled ?? false },
      payments: {
        bkash: store?.settings?.bkashEnabled ?? false,
        nagad: store?.settings?.nagadEnabled ?? false,
        sslcommerz: store?.settings?.sslcommerzEnabled ?? false,
      },
    }
  }

  /* ─── Catalog ─────────────────────────────────────────────── */

  @Get('catalog')
  getCatalog() {
    return { integrations: INTEGRATION_CATALOG }
  }
}
