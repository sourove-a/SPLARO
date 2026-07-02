import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import { ConfigService } from '@nestjs/config'
import { canWriteAdmin } from '../../common/auth/admin-session.util'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import { PrismaService } from '../../common/prisma.service'
import { GoogleWorkspaceService } from '../google-workspace/google-workspace.service'
import { AiIntegrationService, type AiIntegrationDto } from './ai-integration.service'
import { InfrastructureIntegrationService } from './infrastructure-integration.service'
import { IntegrationsService } from './integrations.service'
import { PaymentIntegrationService, type PaymentProvider } from './payment-integration.service'
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
  { id: 'google_sheets', name: 'Google Sheets', configurePath: '/dashboard/google-workspace/sheets-sync', provider: 'google_sheets' },
  { id: 'gmail', name: 'Gmail', configurePath: '/dashboard/google-workspace/gmail', provider: 'gmail' },
  { id: 'google_drive', name: 'Google Drive', configurePath: '/dashboard/google-workspace/drive', provider: 'google_drive' },
  { id: 'sslcommerz', name: 'SSLCommerz', configurePath: '/dashboard/settings?section=payments', provider: 'sslcommerz' },
  { id: 'bkash', name: 'bKash', configurePath: '/dashboard/settings?section=payments', provider: 'bkash' },
  { id: 'nagad', name: 'Nagad', configurePath: '/dashboard/settings?section=payments', provider: 'nagad' },
  { id: 'steadfast', name: 'Steadfast', configurePath: '/dashboard/settings?section=infrastructure', provider: 'steadfast' },
  { id: 'pathao', name: 'Pathao', configurePath: '/dashboard/settings?section=infrastructure', provider: 'pathao' },
  { id: 'redx', name: 'RedX', configurePath: '/dashboard/settings?section=infrastructure', provider: 'redx' },
  { id: 'cloudflare_r2', name: 'Cloudflare R2', configurePath: '/dashboard/settings?section=infrastructure', provider: 'cloudflare_r2' },
  { id: 'smtp', name: 'SMTP Email', configurePath: '/dashboard/settings?section=notifications', provider: 'smtp' },
  { id: 'sms', name: 'SMS Gateway', configurePath: '/dashboard/email-sms', provider: 'sms' },
  { id: 'meta_pixel', name: 'Meta Pixel', configurePath: '/dashboard/settings?section=marketing', provider: 'meta_pixel' },
  { id: 'google_analytics', name: 'Google Analytics', configurePath: '/dashboard/settings?section=marketing', provider: 'google_analytics' },
  { id: 'search_console', name: 'Search Console', configurePath: '/dashboard/seo-health', provider: 'search_console' },
]

@Controller('admin/integrations')
export class IntegrationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
    private readonly telegram: TelegramIntegrationService,
    private readonly ai: AiIntegrationService,
    private readonly google: GoogleWorkspaceService,
    private readonly config: ConfigService,
    private readonly payments: PaymentIntegrationService,
    private readonly infra: InfrastructureIntegrationService,
  ) {}

  private assertWrite(req: AdminRequest) {
    const role = req.adminUser?.role
    if (!role || !canWriteAdmin(role)) {
      throw new ForbiddenException('Insufficient permissions to modify integrations')
    }
    return req.adminUser!.userId
  }

  private isR2Configured(): boolean {
    const key = this.config.get<string>('CLOUDFLARE_R2_ACCESS_KEY') ?? ''
    const secret = this.config.get<string>('CLOUDFLARE_R2_SECRET_KEY') ?? ''
    const bucket = this.config.get<string>('CLOUDFLARE_R2_BUCKET') ?? ''
    const placeholders = new Set(['', 'your-r2-access-key', 'your-r2-secret-key'])
    return Boolean(key && secret && bucket && !placeholders.has(key) && !placeholders.has(secret))
  }

  private resolveConnected(
    provider: string,
    ctx: {
      telegramCfg: Awaited<ReturnType<TelegramIntegrationService['get']>>
      aiCfg: Awaited<ReturnType<AiIntegrationService['get']>>
      store: { settings: Record<string, unknown> | null } | null
      googleStatus: Awaited<ReturnType<GoogleWorkspaceService['getStatus']>> | null
      meta: Awaited<ReturnType<IntegrationsService['getProviderMeta']>>
      paymentByProvider: Map<string, { configured: boolean; source: string }>
      r2Configured: boolean
      steadfastConfigured: boolean
      pathaoConfigured: boolean
      redxConfigured: boolean
    },
  ): { connected: boolean; detail: string | null } {
    const { telegramCfg, aiCfg, store, googleStatus, meta, paymentByProvider, r2Configured, steadfastConfigured, pathaoConfigured, redxConfigured } = ctx
    const settings = store?.settings

    if (provider === 'telegram') {
      const connected = Boolean(telegramCfg.tokenConfigured && telegramCfg.chatId && telegramCfg.isEnabled)
      return {
        connected,
        detail: connected ? `Chat ${telegramCfg.chatId}` : telegramCfg.tokenConfigured ? 'Add chat ID' : 'Add bot token',
      }
    }
    if (provider === 'openai') {
      const connected = Boolean(aiCfg.keyConfigured && aiCfg.isEnabled)
      return { connected, detail: connected ? aiCfg.model : aiCfg.keyConfigured ? 'Enable in AI Agent' : 'Add API key' }
    }
    if (provider === 'bkash') {
      const pay = paymentByProvider.get('bkash')
      const enabled = Boolean(settings?.bkashEnabled)
      const connected = enabled && Boolean(pay?.configured)
      return {
        connected,
        detail: connected
          ? `Live · ${pay?.source === 'database' ? 'saved in admin' : 'from .env'}`
          : enabled
            ? 'Enabled — add API keys below'
            : 'Enable + add keys in Payments',
      }
    }
    if (provider === 'nagad') {
      const pay = paymentByProvider.get('nagad')
      const enabled = Boolean(settings?.nagadEnabled)
      const connected = enabled && Boolean(pay?.configured)
      return {
        connected,
        detail: connected
          ? `Live · ${pay?.source === 'database' ? 'saved in admin' : 'from .env'}`
          : enabled
            ? 'Enabled — add API keys below'
            : 'Enable + add keys in Payments',
      }
    }
    if (provider === 'sslcommerz') {
      const pay = paymentByProvider.get('sslcommerz')
      const enabled = Boolean(settings?.sslcommerzEnabled)
      const connected = enabled && Boolean(pay?.configured)
      return {
        connected,
        detail: connected
          ? `Live · ${pay?.source === 'database' ? 'saved in admin' : 'from .env'}`
          : enabled
            ? 'Enabled — add store credentials below'
            : 'Enable + add keys in Payments',
      }
    }
    if (provider === 'meta_pixel') {
      const id = settings?.facebookPixelId as string | undefined
      return { connected: Boolean(id), detail: id ? `Pixel ${id}` : 'Add Pixel ID in settings' }
    }
    if (provider === 'google_analytics') {
      const id = settings?.googleAnalyticsId as string | undefined
      return { connected: Boolean(id), detail: id ? `GA4 ${id}` : 'Add Measurement ID' }
    }
    if (provider === 'search_console') {
      const key = settings?.googleSearchConsoleKey as string | undefined
      return { connected: Boolean(key), detail: key ? 'Verification key saved' : 'Add verification key' }
    }
    if (provider === 'smtp') {
      const connected = Boolean(settings?.emailEnabled)
      return { connected, detail: connected ? 'SMTP enabled' : 'Enable email in settings' }
    }
    if (provider === 'google_sheets') {
      const connected = Boolean(googleStatus?.services?.sheets?.connected)
      const email = googleStatus?.googleEmail
      const mode = googleStatus?.authMode === 'service_account' ? 'Service account' : 'OAuth'
      return {
        connected,
        detail: connected
          ? `${mode}${email ? ` · ${email}` : ''}`
          : googleStatus?.oauthConfigReady
            ? 'Connect Google Workspace'
            : 'Add Google OAuth credentials',
      }
    }
    if (provider === 'gmail') {
      const connected = Boolean(googleStatus?.services?.gmail?.connected)
      const email = googleStatus?.services?.gmail?.senderEmail ?? googleStatus?.oauthEmail
      return {
        connected,
        detail: connected ? (email ? `Send as ${email}` : 'Gmail API ready') : 'Connect via Google Workspace',
      }
    }
    if (provider === 'google_drive') {
      const connected = Boolean(googleStatus?.services?.drive?.connected)
      return {
        connected,
        detail: connected ? 'Drive folder linked' : googleStatus?.oauthConnected ? 'Set root folder' : 'Connect Google Workspace',
      }
    }
    if (provider === 'steadfast') {
      const stub = process.env.COURIER_DEV_STUB === 'true'
      const connected = steadfastConfigured || stub
      return {
        connected,
        detail: steadfastConfigured
          ? 'API keys saved'
          : stub
            ? 'Dev stub (COURIER_DEV_STUB)'
            : 'Add keys in Infrastructure settings',
      }
    }
    if (provider === 'pathao') {
      return {
        connected: pathaoConfigured,
        detail: pathaoConfigured ? 'API keys saved' : 'Add keys in Infrastructure settings',
      }
    }
    if (provider === 'redx') {
      return {
        connected: redxConfigured,
        detail: redxConfigured ? 'API key saved' : 'Add API key in Infrastructure settings',
      }
    }
    if (provider === 'cloudflare_r2') {
      return {
        connected: r2Configured,
        detail: r2Configured ? 'R2 bucket configured' : 'Add R2 keys in Infrastructure',
      }
    }
    if (provider === 'sms') {
      const connected = meta.lastTestStatus === 'success'
      return { connected, detail: connected ? 'Gateway tested OK' : 'Configure in Email & SMS' }
    }

    const connected = meta.lastTestStatus === 'success'
    return { connected, detail: connected ? 'Last test passed' : 'Run connection test' }
  }

  @Get()
  async list(@Query('storeId') storeId: string) {
    const sid = await this.integrations.resolveStore(storeId)
    const store = await this.prisma.store.findUnique({
      where: { id: sid },
      include: { settings: true, telegramConfig: true },
    })

    const [telegramCfg, aiCfg, googleStatus, paymentAll, r2Cfg, steadfastCfg, pathaoCfg, redxCfg] = await Promise.all([
      this.telegram.get(sid),
      this.ai.get(sid),
      this.google.getStatus(storeId).catch(() => null),
      this.payments.getAll(storeId),
      this.infra.getConfig(storeId, 'cloudflare_r2'),
      this.infra.getConfig(storeId, 'steadfast'),
      this.infra.getConfig(storeId, 'pathao'),
      this.infra.getConfig(storeId, 'redx'),
    ])

    const paymentByProvider = new Map(paymentAll.items.map((p) => [p.provider, p]))

    const cards = await Promise.all(
      INTEGRATION_CATALOG.map(async (item) => {
        const meta = await this.integrations.getProviderMeta(sid, item.provider)
        const { connected, detail } = this.resolveConnected(item.provider, {
          telegramCfg,
          aiCfg,
          store,
          googleStatus,
          meta,
          paymentByProvider,
          r2Configured: r2Cfg.configured,
          steadfastConfigured: steadfastCfg.configured,
          pathaoConfigured: pathaoCfg.configured,
          redxConfigured: redxCfg.configured,
        })

        const tokenIssue =
          (item.provider === 'gmail' || item.provider === 'google_sheets' || item.provider === 'google_drive') &&
          (googleStatus?.tokenHealth === 'expired' || googleStatus?.tokenHealth === 'revoked')

        return {
          id: item.id,
          name: item.name,
          provider: item.provider,
          configurePath: item.configurePath,
          connected,
          connectionDetail: detail,
          status: connected
            ? 'connected'
            : tokenIssue || meta.lastTestStatus === 'failed'
              ? 'error'
              : 'not_connected',
          isEnabled: meta.isEnabled,
          lastTestedAt: meta.lastTestedAt,
          lastTestStatus: meta.lastTestStatus,
          lastError: tokenIssue
            ? googleStatus?.lastError ?? 'Google token expired — reconnect OAuth'
            : meta.lastTestStatus === 'failed'
              ? meta.lastTestMessage
              : null,
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

  /* ─── Payment credentials (DB + env fallback) ─────────────── */

  @Get('payments')
  getPayments(@Query('storeId') storeId: string) {
    return this.payments.getAll(storeId)
  }

  @Get('payments/:provider')
  getPayment(@Param('provider') provider: PaymentProvider, @Query('storeId') storeId: string) {
    return this.payments.getConfig(storeId, provider)
  }

  @Put('payments/:provider')
  updatePayment(
    @Param('provider') provider: PaymentProvider,
    @Query('storeId') storeId: string,
    @Body() body: Record<string, string | boolean>,
    @Req() req: AdminRequest,
  ) {
    const userId = this.assertWrite(req)
    return this.payments.update(storeId, provider, body, userId)
  }

  @Post('payments/:provider/test')
  testPayment(
    @Param('provider') provider: PaymentProvider,
    @Query('storeId') storeId: string,
    @Req() req: AdminRequest,
  ) {
    this.assertWrite(req)
    return this.payments.test(storeId, provider, req.adminUser?.userId)
  }

  /* ─── Infrastructure credentials ────────────────────────────── */

  @Get('infrastructure/:provider')
  getInfrastructure(
    @Param('provider') provider: 'cloudflare_r2' | 'steadfast' | 'pathao' | 'redx',
    @Query('storeId') storeId: string,
  ) {
    return this.infra.getConfig(storeId, provider)
  }

  @Put('infrastructure/:provider')
  updateInfrastructure(
    @Param('provider') provider: 'cloudflare_r2' | 'steadfast' | 'pathao' | 'redx',
    @Query('storeId') storeId: string,
    @Body() body: Record<string, string>,
    @Req() req: AdminRequest,
  ) {
    const userId = this.assertWrite(req)
    return this.infra.update(storeId, provider, body, userId)
  }

  @Post('infrastructure/:provider/test')
  testInfrastructure(
    @Param('provider') provider: 'pathao' | 'redx',
    @Query('storeId') storeId: string,
    @Req() req: AdminRequest,
  ) {
    this.assertWrite(req)
    return this.infra.test(storeId, provider, req.adminUser?.userId)
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
