import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ModuleRef } from '@nestjs/core'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { InvoiceService } from '../invoices/invoice.service'
import { CourierService } from '../courier/courier.service'
import { OrderStatusService } from '../orders/order-status.service'
import { AgentService } from '../agent'
import { AuthService } from '../auth/auth.service'
import { AdminLoginTokenService } from '../auth/admin-login-token.service'
import { TelegramIntegrationService } from '../integrations/telegram-integration.service'
import TelegramBot from 'node-telegram-bot-api'
import type {
  Chat,
  InlineKeyboardMarkup,
  Message,
  Update,
} from 'node-telegram-bot-api'
import { escapeTelegramHtml, mapStaffRoleToTelegram, maskTelegramId, stripTelegramHtml } from './telegram.util'
import {
  formatNewOrderTelegramMessage,
  type TelegramNewOrderPayload,
} from './telegram-order-message'
import type { TelegramDeliveryDiagnostics, TelegramHealthSnapshot } from './telegram.types'
import { formatBDT } from '../../common/utils/currency'
import { resolveCustomerFacingAdminUrl, resolveCustomerFacingSiteUrl } from '@splaro/config'
import { buildInvoiceAccessToken } from '@splaro/config/invoice-access'
import type { TelegramRole } from '@prisma/client'
import {
  BOT_COMMANDS,
  TELEGRAM_AI_UNAVAILABLE,
  TG_CALLBACK,
  aiPromptForAction,
  aiPromptLabel,
  collectNewOrderChatIds,
  telegramConfirmInvoiceAction,
  deliveryDiagnosticsKeyboard,
  formatLoginTokenDisplay,
  formatTelegramAiReply,
  formatWhatsAppUrl,
  inlineAdminMenu,
  inlineAiMenu,
  inlineCourierMenu,
  inlineFinanceMenu,
  inlineInventoryMenu,
  inlineMainMenu,
  inlineOrdersMenu,
  isStaleTelegramKeyboardLabel,
  isTelegramAiAction,
  linkedAdminsKeyboard,
  loginCopyKeyboard,
  mainReplyKeyboard,
  menuMessage,
  orderListKeyboard,
  orderActionKeyboard,
  parseListCallback,
  parseOrderCallback,
  premiumHeader,
  resolveTelegramButtonRoute,
  sanitizeTelegramAiError,
  shouldRouteUnmatchedTextToAi,
  telegramOpsHint,
  welcomeMessage,
} from './telegram-ui'

interface TelegramCtx {
  chatId: string
  userId: string
  storeId: string
  configId: string
  isGroup: boolean
}

@Injectable()
export class TelegramService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(TelegramService.name)
  private bot: TelegramBot | null = null
  private botTokenSource: 'env' | 'database' | 'none' = 'none'
  private lastDeliveryStatus: 'success' | 'failed' | 'none' = 'none'
  private lastDeliveryError: string | null = null
  private lastDeliveryAt: Date | null = null
  private readonly notificationDedupe = new Map<string, number>()
  private readonly aiModeChats = new Set<string>()

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InvoiceService) private readonly invoices: InvoiceService,
    @Inject(forwardRef(() => CourierService))
    private readonly courier: CourierService,
    private readonly orderStatus: OrderStatusService,
    @Inject(forwardRef(() => TelegramIntegrationService))
    private readonly telegramIntegration: TelegramIntegrationService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    await this.initializeBot()
  }

  /** Re-load bot token after admin saves credentials in the panel. */
  async reinitializeBot(): Promise<void> {
    if (this.bot) {
      try {
        await this.bot.stopPolling()
      } catch {
        /* polling may not be active */
      }
      this.bot = null
    }
    await this.initializeBot()
  }

  private isPrimaryClusterInstance(): boolean {
    const instance = process.env.NODE_APP_INSTANCE ?? process.env.pm_id ?? '0'
    return String(instance) === '0'
  }

  private async initializeBot(): Promise<void> {
    const token = await this.resolveBotToken()
    if (!token) {
      this.logger.warn('Telegram bot token not configured (env or database) — bot disabled')
      return
    }

    const webhookUrl = this.config.get<string>('TELEGRAM_WEBHOOK_URL')?.trim()
    const pollingEnv = this.config.get<string>('SPLARO_TELEGRAM_POLLING')
    const usePolling =
      !webhookUrl &&
      this.isPrimaryClusterInstance() &&
      pollingEnv !== '0'
    this.bot = new TelegramBot(token, usePolling ? { polling: true } : {})
    void this.bot.setMyCommands(BOT_COMMANDS).catch(() => undefined)
    this.registerCommands()

    if (webhookUrl) {
      this.logger.log(`Telegram bot ready (webhook mode → ${webhookUrl.replace(/\/$/, '')})`)
    } else if (usePolling) {
      this.logger.log('Telegram bot initialized (polling)')
    } else {
      this.logger.log('Telegram bot ready (send-only — polling disabled on this process)')
    }
  }

  /**
   * A token saved in Admin → Telegram Bot wins over TELEGRAM_BOT_TOKEN.
   *
   * The order used to be the other way round, so on any deployment that had the
   * env var set — production does — pasting a token in the admin panel stored it
   * and then silently kept using the old one. Env is now the bootstrap value for
   * a fresh install, and the panel is what an operator can actually change.
   */
  private async resolveBotToken(): Promise<string | null> {
    const slug = this.config.get<string>('TELEGRAM_STORE_SLUG')?.trim() || 'splaro'
    try {
      const storeId = await resolveStoreId(this.prisma, slug)
      const cfg = await this.telegramIntegration.resolveRuntimeConfig(storeId)
      if (cfg?.token) {
        this.botTokenSource = 'database'
        return cfg.token
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'resolveRuntimeConfig failed'
      this.logger.warn(`Telegram DB token lookup failed: ${msg}`)
    }

    const envToken = this.config.get<string>('TELEGRAM_BOT_TOKEN')?.trim()
    if (envToken) {
      this.botTokenSource = 'env'
      return envToken
    }

    this.botTokenSource = 'none'
    return null
  }

  /**
   * Ask Telegram whether a token is real before anything is stored or used.
   * A typo previously surfaced only as `ETELEGRAM: 401 Unauthorized` in a log
   * nobody reads, while the admin panel reported success.
   */
  async verifyBotToken(token: string): Promise<
    { ok: true; username: string; botId: number } | { ok: false; error: string }
  > {
    const trimmed = token.trim()
    if (!trimmed) return { ok: false, error: 'Token is empty' }
    if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(trimmed)) {
      return { ok: false, error: 'Not a Telegram bot token (expected 123456:ABC-DEF…)' }
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${trimmed}/getMe`, {
        signal: AbortSignal.timeout(8000),
      })
      const body = (await res.json()) as {
        ok?: boolean
        description?: string
        result?: { id?: number; username?: string }
      }
      if (!body.ok || !body.result?.username) {
        return { ok: false, error: body.description ?? `Telegram rejected the token (${res.status})` }
      }
      return { ok: true, username: body.result.username, botId: body.result.id ?? 0 }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Could not reach api.telegram.org',
      }
    }
  }

  /** Register webhook after HTTP server is listening so Telegram can reach the endpoint. */
  async onApplicationBootstrap() {
    const webhookUrl = this.config.get<string>('TELEGRAM_WEBHOOK_URL')?.trim()
    if (!this.bot || !webhookUrl) return
    if (!this.isPrimaryClusterInstance()) {
      this.logger.log('Telegram webhook registration skipped on secondary cluster instance')
      return
    }

    const secret = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET')
    const target = webhookUrl.replace(/\/$/, '')

    try {
      await this.bot.setWebHook(webhookUrl, {
        ...(secret ? { secret_token: secret } : {}),
        allowed_updates: ['message', 'callback_query'],
      })
      const info = await this.bot.getWebHookInfo()
      const registered = info?.url?.replace(/\/$/, '') ?? ''
      if (registered === target) {
        this.logger.log(`Telegram webhook registered → ${target}`)
        return
      }
      this.logger.warn(`Telegram webhook mismatch (expected ${target}, got ${registered || 'empty'}) — retrying…`)
      await new Promise((r) => setTimeout(r, 2000))
      await this.bot.setWebHook(webhookUrl, {
        ...(secret ? { secret_token: secret } : {}),
        allowed_updates: ['message', 'callback_query'],
      })
      const retryInfo = await this.bot.getWebHookInfo()
      const retryUrl = retryInfo?.url?.replace(/\/$/, '') ?? ''
      if (retryUrl === target) {
        this.logger.log(`Telegram webhook registered → ${target}`)
        return
      }
      this.logger.error(
        `Telegram webhook registration mismatch (expected ${target}, got ${retryUrl || 'empty'})`,
      )
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'setWebHook failed'
      this.logger.error(`Telegram webhook setup failed: ${errMsg}`)
    }
  }

  // ── SEND METHODS ──────────────────────────────────────────

  async sendToStore(
    storeId: string,
    message: string,
    replyMarkup?: InlineKeyboardMarkup,
    extras?: { disableWebPagePreview?: boolean },
  ): Promise<void> {
    await this.sendToStoreWithResult(storeId, message, replyMarkup, extras)
  }


  /**
   * Send with parse_mode HTML, and fall back to plain text when Telegram
   * rejects the markup.
   *
   * Telegram answers 400 "can't parse entities" for the *whole* message if any
   * interpolated value contains a stray `<` or `&` — a customer named
   * "…<Udman>!" silently killed every /start reply, so the bot looked dead.
   * Escaping at the template is the real fix; this is the net that stops one
   * missed escape from ever losing a message again.
   */
  private async sendHtmlWithPlainFallback(
    chatId: string,
    html: string,
    options: Record<string, unknown> = {},
  ): Promise<boolean> {
    if (!this.bot) return false
    try {
      await this.bot.sendMessage(chatId, html, { parse_mode: 'HTML', ...options })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown'
      if (!/can't parse entities|unsupported start tag/i.test(message)) {
        this.logger.error(`Telegram send failed (${maskTelegramId(chatId)}): ${message}`)
        return false
      }
      this.logger.warn(
        `Telegram HTML rejected (${maskTelegramId(chatId)}): ${message} — resending as plain text`,
      )
    }
    try {
      await this.bot.sendMessage(chatId, stripTelegramHtml(html), options)
      return true
    } catch (err) {
      this.logger.error(
        `Telegram plain fallback failed (${maskTelegramId(chatId)}): ${err instanceof Error ? err.message : 'unknown'}`,
      )
      return false
    }
  }

  /** Returns whether the message was delivered to the store Telegram chat. */
  async sendToStoreWithResult(
    storeId: string,
    message: string,
    replyMarkup?: InlineKeyboardMarkup,
    extras?: { disableWebPagePreview?: boolean },
  ): Promise<boolean> {
    const config = await this.prisma.telegramConfig.findUnique({ where: { storeId } })
    if (!config?.isActive || !this.bot) return false

    try {
      await this.bot.sendMessage(config.chatId, message, {
        parse_mode: 'HTML',
        link_preview_options: {
          is_disabled: extras?.disableWebPagePreview ?? true,
        },
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      })
      await this.prisma.telegramLog.create({
        data: { configId: config.id, type: 'NOTIFICATION', message, success: true },
      })
      return true
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      this.logger.error(`Telegram send failed: ${errMsg}`)
      await this.prisma.telegramLog.create({
        data: { configId: config.id, type: 'ERROR', message: errMsg, success: false },
      })
      return false
    }
  }

  /** Sends invoice PDF (or HTML fallback) to a Telegram chat after order confirm. */
  async sendInvoiceToChat(
    storeId: string,
    chatId: string,
    invoiceNumber: string,
  ): Promise<{ sent: boolean; format?: 'pdf' | 'html' }> {
    if (!this.bot) return { sent: false }

    const order = await this.prisma.order.findFirst({
      where: { storeId, invoiceNumber },
      select: { id: true },
    })
    if (!order) return { sent: false }

    const config = await this.prisma.telegramConfig.findUnique({ where: { storeId } })

    try {
      let buffer: Buffer
      let filename: string
      let format: 'pdf' | 'html'

      try {
        buffer = await this.invoices.buildPdfBuffer(order.id)
        filename = `${invoiceNumber}.pdf`
        format = 'pdf'
      } catch {
        const html = await this.invoices.buildHtml(order.id, { showToolbar: false })
        buffer = Buffer.from(html, 'utf8')
        filename = `${invoiceNumber}.html`
        format = 'html'
      }

      await this.bot.sendDocument(
        chatId,
        buffer,
        {
          caption: `📄 <b>Invoice ${invoiceNumber}</b>\n<i>SPLARO — confirmed order</i>`,
          parse_mode: 'HTML',
        },
        { filename, contentType: format === 'pdf' ? 'application/pdf' : 'text/html' },
      )

      if (config) {
        await this.prisma.telegramLog.create({
          data: {
            configId: config.id,
            type: 'NOTIFICATION',
            message: `Invoice ${invoiceNumber} sent (${format})`,
            success: true,
          },
        })
      }

      return { sent: true, format }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      this.logger.error(`Telegram invoice send failed: ${errMsg}`)
      if (config) {
        await this.prisma.telegramLog.create({
          data: { configId: config.id, type: 'ERROR', message: errMsg, success: false },
        })
      }
      return { sent: false }
    }
  }

  /** Confirms order and sends invoice document to Telegram chat. */
  async confirmOrderAndSendInvoice(
    storeId: string,
    chatId: string,
    invoiceNumber: string,
    telegramUserId?: string,
  ): Promise<{ confirmed: boolean; invoiceSent: boolean; format?: 'pdf' | 'html' }> {
    const config = await this.prisma.telegramConfig.findUnique({ where: { storeId } })
    const targetChat = chatId || config?.chatId
    if (!targetChat) {
      return { confirmed: false, invoiceSent: false }
    }

    const order = await this.prisma.order.findFirst({
      where: { storeId, invoiceNumber },
      select: { id: true, status: true },
    })
    if (!order) {
      await this.bot?.sendMessage(targetChat, '❌ Order not found')
      return { confirmed: false, invoiceSent: false }
    }

    const confirmAction = telegramConfirmInvoiceAction(order.status)
    if (confirmAction === 'already') {
      await this.bot?.sendMessage(
        targetChat,
        `✅ Order <b>${invoiceNumber}</b> already confirmed`,
        { parse_mode: 'HTML' },
      )
      return { confirmed: true, invoiceSent: false }
    }

    try {
      await this.orderStatus.applyStatusChange(
        order.id,
        'CONFIRMED',
        telegramUserId ? 'Confirmed via Telegram bot' : 'Confirmed via Telegram',
        storeId,
      )
      await this.bot?.sendMessage(targetChat, `✅ Order <b>${invoiceNumber}</b> confirmed`, {
        parse_mode: 'HTML',
      })
      if (telegramUserId) {
        await this.logCommand(targetChat, `/confirm_order ${invoiceNumber}`, telegramUserId)
      }
    } catch (err) {
      const detail =
        err instanceof BadRequestException
          ? String(
              typeof err.getResponse() === 'string'
                ? err.getResponse()
                : (err.getResponse() as { message?: string }).message ?? err.message,
            )
          : 'Status transition not allowed'
      await this.bot?.sendMessage(
        targetChat,
        `❌ Cannot confirm <b>${invoiceNumber}</b>\nCurrent: ${order.status.replace(/_/g, ' ')}\n${detail}`,
        { parse_mode: 'HTML' },
      )
      return { confirmed: false, invoiceSent: false }
    }

    const invoice = await this.sendInvoiceToChat(storeId, targetChat, invoiceNumber)
    if (!invoice.sent) {
      await this.bot?.sendMessage(
        targetChat,
        `⚠️ Order confirmed but invoice could not be sent. Try /order ${invoiceNumber}`,
      )
    }

    return {
      confirmed: true,
      invoiceSent: invoice.sent,
      ...(invoice.format ? { format: invoice.format } : {}),
    }
  }

  async notifyNewOrder(storeId: string, order: TelegramNewOrderPayload): Promise<void> {
    const dedupeKey = `new-order:${storeId}:${order.invoiceNumber}`
    if (!this.shouldSendNotification(dedupeKey)) return

    const config = await this.prisma.telegramConfig.findUnique({ where: { storeId } })
    if (!config?.notifyOrders) return

    let customerHistory: TelegramNewOrderPayload['customerHistory'] = null
    let steadfastReport: TelegramNewOrderPayload['steadfastReport'] = null

    try {
      if (order.shippingPhone) {
        const [pastOrdersRes, sfRes] = await Promise.allSettled([
          this.prisma.order.findMany({
            where: {
              storeId,
              shippingPhone: order.shippingPhone,
            },
            select: { status: true },
          }),
          this.courier?.checkCustomerFraud(storeId, order.shippingPhone),
        ])

        if (pastOrdersRes.status === 'fulfilled' && pastOrdersRes.value.length > 0) {
          const pastOrders = pastOrdersRes.value
          const totalOrders = pastOrders.length
          const deliveredOrders = pastOrders.filter((o) => o.status === 'DELIVERED').length
          const returnedOrCancelled = pastOrders.filter(
            (o) => o.status === 'RETURNED' || o.status === 'CANCELLED',
          ).length
          customerHistory = { totalOrders, deliveredOrders, returnedOrCancelled }
        }

        if (sfRes.status === 'fulfilled' && sfRes.value) {
          steadfastReport = sfRes.value
        }
      }
    } catch {
      // Non-blocking report lookup
    }

    const payloadWithReports = {
      ...order,
      ...(customerHistory ? { customerHistory } : {}),
      ...(steadfastReport ? { steadfastReport } : {}),
    }
    const msg = formatNewOrderTelegramMessage(payloadWithReports)
    const adminBase = resolveCustomerFacingAdminUrl(
      this.config.get<string>('ADMIN_URL') ?? this.config.get<string>('NEXT_PUBLIC_ADMIN_URL'),
    )
    const adminOrderUrl = `${adminBase.replace(/\/+$/, '').replace(/\/login$/i, '')}/dashboard/orders/${encodeURIComponent(order.invoiceNumber)}`
    const storefrontUrl = resolveCustomerFacingSiteUrl(order.siteUrl)
    const keyboard = orderActionKeyboard(order.invoiceNumber, {
      adminOrderUrl,
      storefrontUrl,
      phone: order.shippingPhone,
    })

    const linkedAdmins = await this.prisma.telegramUser.findMany({
      where: {
        isActive: true,
        role: { in: ['SUPER_ADMIN', 'MANAGER'] },
        config: { storeId, isActive: true },
      },
      select: { telegramId: true },
    })
    const destinations = collectNewOrderChatIds({
      configChatId: config.chatId,
      linkedTelegramIds: linkedAdmins.map((u) => u.telegramId),
      envAdminUserId: this.config.get<string>('TELEGRAM_ADMIN_USER_ID'),
    })
    if (destinations.length === 0) return

    const extras = {
      link_preview_options: { is_disabled: true },
      reply_markup: keyboard,
    }
    let delivered = false
    for (const chatId of destinations) {
      const ok = await this.sendHtmlWithPlainFallback(chatId, msg, extras)
      if (ok) delivered = true
    }
    await this.prisma.telegramLog.create({
      data: {
        configId: config.id,
        type: delivered ? 'NOTIFICATION' : 'ERROR',
        message: delivered ? msg : 'New order fan-out failed for all destinations',
        success: delivered,
      },
    })
  }

  async notifySmtpConfigured(
    storeId: string,
    smtp: { host: string; fromEmail: string; fromName: string },
  ): Promise<void> {
    const msg = `
📧 <b>SMTP Email Connected</b>

Host: <code>${smtp.host}</code>
From: ${smtp.fromName} &lt;${smtp.fromEmail}&gt;
Status: Ready to send invoices

<i>Customer order emails will now be delivered automatically.</i>
`.trim()
    await this.sendToStore(storeId, msg)
  }

  async notifyPaymentEvent(
    storeId: string,
    input: { invoiceNumber: string; status: 'started' | 'returned' | 'failed'; gateway?: string },
  ): Promise<void> {
    const dedupeKey = `payment:${storeId}:${input.invoiceNumber}:${input.status}`
    if (!this.shouldSendNotification(dedupeKey)) return

    const config = await this.prisma.telegramConfig.findUnique({ where: { storeId } })
    if (!config?.notifyPayments) return

    const icon =
      input.status === 'failed' ? '❌' : input.status === 'returned' ? '↩️' : '💳'
    const label =
      input.status === 'failed'
        ? 'Payment Failed / Cancelled'
        : input.status === 'returned'
          ? 'Customer Returned From Gateway'
          : 'Payment Started'

    const msg = `
${icon} <b>${label}</b>
━━━━━━━━━━━━━━━━━━━━
📋 Order: <code>${input.invoiceNumber}</code>
💳 Gateway: ${input.gateway ?? 'Online payment'}
━━━━━━━━━━━━━━━━━━━━
<i>Send <code>${input.invoiceNumber}</code> to track</i>
`.trim()

    await this.sendToStore(storeId, msg)
  }

  /** Late gateway success on CANCELLED/REFUNDED order — money may be stuck; needs manual action. */
  async notifyStalePaymentOnDeadOrder(
    storeId: string,
    input: {
      invoiceNumber: string
      orderStatus: string
      gateway: string
      transactionId: string
      amount: number
    },
  ): Promise<void> {
    const dedupeKey = `stale-payment:${storeId}:${input.invoiceNumber}:${input.transactionId}`
    if (!this.shouldSendNotification(dedupeKey, 15 * 60_000)) return

    const config = await this.prisma.telegramConfig.findUnique({ where: { storeId } })
    if (!config?.notifyPayments) return

    const msg = `
🚨 <b>HIGH PRIORITY — Money Stuck</b>

Order: <code>${input.invoiceNumber}</code>
Status: <b>${input.orderStatus}</b>
Gateway: ${input.gateway}
Paid: <b>${formatBDT(input.amount)}</b>
TxID: <code>${input.transactionId}</code>

Customer was charged AFTER this order was ${input.orderStatus}.
<b>Action:</b> refund manually or re-open the order.

<i>Check order history note for audit trail.</i>
`.trim()

    await this.sendToStore(storeId, msg)
  }

  async replyOrderTrack(chatId: string, invoiceNumber: string, storeId?: string): Promise<void> {
    const order = await this.prisma.order.findFirst({
      where: { invoiceNumber },
      include: { items: { take: 4 }, courier: true },
    })

    if (!order) {
      const latest = storeId ? await this.latestInvoiceNumber(storeId) : null
      const hint = latest
        ? `\nLatest live invoice: <code>${latest}</code>`
        : '\nType a live invoice (SPL-####), or tap Control Center.'
      await this.bot?.sendMessage(
        chatId,
        `❌ Order <code>${invoiceNumber}</code> not found.${hint}`,
        { parse_mode: 'HTML', reply_markup: mainReplyKeyboard() },
      )
      return
    }

    const statusEmoji: Record<string, string> = {
      PENDING: '⏳',
      CONFIRMED: '✅',
      PROCESSING: '🔧',
      COURIER_BOOKED: '🚚',
      IN_TRANSIT: '📦',
      DELIVERED: '✅',
      CANCELLED: '❌',
      RETURNED: '🔄',
    }

    const items = order.items
      .map((item) => `• ${item.productName} × ${item.quantity}`)
      .join('\n')

    const msg = `
📦 <b>Order ${invoiceNumber}</b>

Status: ${statusEmoji[order.status] ?? '•'} ${order.status.replace(/_/g, ' ')}
Payment: ${order.paymentStatus.replace(/_/g, ' ')} · ${order.paymentMethod.replace(/_/g, ' ')}
Total: <b>${formatBDT(Number(order.total))}</b>
Customer: ${order.shippingName}
Phone: <code>${order.shippingPhone}</code>
City: ${order.shippingCity}
${order.courier?.trackingCode ? `Tracking: <code>${order.courier.trackingCode}</code>` : 'Courier: Not booked yet'}

<b>Items</b>
${items}
`.trim()

    const adminBase = resolveCustomerFacingAdminUrl(
      this.config.get<string>('ADMIN_URL') ?? this.config.get<string>('NEXT_PUBLIC_ADMIN_URL'),
    )
    const adminOrderUrl = `${adminBase.replace(/\/+$/, '').replace(/\/login$/i, '')}/dashboard/orders/${encodeURIComponent(order.invoiceNumber)}`
    const storefrontUrl = resolveCustomerFacingSiteUrl()

    await this.bot?.sendMessage(chatId, msg, {
      parse_mode: 'HTML',
      reply_markup: orderActionKeyboard(order.invoiceNumber, {
        adminOrderUrl,
        storefrontUrl,
        phone: order.shippingPhone,
      }),
    })
  }

  private async latestInvoiceNumber(storeId: string): Promise<string | null> {
    const row = await this.prisma.order.findFirst({
      where: { storeId, status: { not: 'CANCELLED' } },
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true },
    })
    return row?.invoiceNumber ?? null
  }

  async notifyLowStock(storeId: string, items: { name: string; sku: string; stock: number }[]): Promise<void> {
    const config = await this.prisma.telegramConfig.findUnique({ where: { storeId } })
    if (!config?.notifyStock) return

    const list = items.map((i) => `  🔸 ${i.name} (<code>${i.sku}</code>): <b>${i.stock} left</b>`).join('\n')
    const msg = `🚨 <b>Low Stock Alert</b>\n━━━━━━━━━━━━━━━━━━━━\n${list}\n━━━━━━━━━━━━━━━━━━━━\n<i>Restock soon to avoid stockouts</i>`
    await this.sendToStore(storeId, msg)
  }

  async notifyCourierFailed(storeId: string, order: {
    invoiceNumber: string
    provider: string
    error: string
  }): Promise<void> {
    const config = await this.prisma.telegramConfig.findUnique({ where: { storeId } })
    if (!config?.notifyCourier) return

    const msg = `
❌ <b>Courier Booking Failed</b>
━━━━━━━━━━━━━━━━━━━━
📋 Invoice: <code>${order.invoiceNumber}</code>
🏢 Provider: ${order.provider}
⚠️ Error: ${order.error}
━━━━━━━━━━━━━━━━━━━━
<i>Added to retry queue · Check admin panel</i>
`.trim()

    await this.sendToStore(storeId, msg)
  }

  async notifyCourierBooked(storeId: string, order: {
    invoiceNumber: string
    provider: string
    consignmentId?: string
    trackingCode?: string
    trackingUrl?: string
  }): Promise<void> {
    const config = await this.prisma.telegramConfig.findUnique({ where: { storeId } })
    if (!config?.notifyCourier) return

    const tracking = order.trackingCode
      ? `\n📦 Tracking: <code>${order.trackingCode}</code>${order.trackingUrl ? `\n🔗 ${order.trackingUrl}` : ''}`
      : order.consignmentId
        ? `\n📦 Consignment: <code>${order.consignmentId}</code>`
        : ''

    const msg = `
✅ <b>Courier Booked</b>
━━━━━━━━━━━━━━━━━━━━
📋 Invoice: <code>${order.invoiceNumber}</code>
🏢 Provider: ${order.provider}${tracking}
━━━━━━━━━━━━━━━━━━━━
<i>Parcel ready for pickup</i>
`.trim()

    await this.sendToStore(storeId, msg)
  }

  async sendDailyReport(storeId: string): Promise<void> {
    const config = await this.prisma.telegramConfig.findUnique({ where: { storeId } })
    if (!config?.reportDaily) return

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [orders, revenue] = await Promise.all([
      this.prisma.order.count({ where: { storeId, createdAt: { gte: today } } }),
      this.prisma.order.aggregate({
        where: { storeId, createdAt: { gte: today }, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }),
    ])

    const msg = `
┌──────────────────────────┐
│  📊 <b>Daily Report</b>              │
│  ${today.toLocaleDateString('en-BD')}           │
└──────────────────────────┘

📦 Orders today: <b>${orders}</b>
💰 Revenue: <b>${formatBDT(Number(revenue._sum.total ?? 0))}</b>

━━━━━━━━━━━━━━━━━━━━
<i>Full analytics on admin panel</i>
`.trim()

    await this.sendToStore(storeId, msg)
  }

  // ── COMMAND REGISTRATION ──────────────────────────────────

  private registerCommands(): void {
    if (!this.bot) return

    const route = (pattern: RegExp, action: string) => {
      this.bot!.onText(pattern, async (msg) => {
        const ctx = await this.resolveContext(msg)
        if (!ctx) return
        await this.executeAction(action, ctx, msg)
      })
    }

    route(/^\/start(?:@\w+)?(?:\s|$)/i, TG_CALLBACK.MENU_MAIN)
    route(/^\/menu(?:@\w+)?(?:\s|$)/i, TG_CALLBACK.MENU_MAIN)
    route(/^\/help(?:@\w+)?(?:\s|$)/i, 'help')
    route(/^\/today_orders(?:@\w+)?(?:\s|$)/i, TG_CALLBACK.ORDERS_TODAY)
    route(/^\/today_sales(?:@\w+)?(?:\s|$)/i, TG_CALLBACK.SALES_TODAY)
    route(/^\/pending_orders(?:@\w+)?(?:\s|$)/i, TG_CALLBACK.PENDING)
    route(/^\/low_stock(?:@\w+)?(?:\s|$)/i, TG_CALLBACK.LOW_STOCK)
    route(/^\/report_today(?:@\w+)?(?:\s|$)/i, TG_CALLBACK.REPORT_TODAY)
    route(/^\/delivered_today(?:@\w+)?(?:\s|$)/i, TG_CALLBACK.DELIVERED_TODAY)
    route(/^\/profit_today(?:@\w+)?(?:\s|$)/i, TG_CALLBACK.PROFIT_TODAY)
    route(/^\/profit_month(?:@\w+)?(?:\s|$)/i, TG_CALLBACK.PROFIT_MONTH)
    route(/^\/expenses_today(?:@\w+)?(?:\s|$)/i, TG_CALLBACK.EXPENSES_TODAY)
    route(/^\/sync_sheets(?:@\w+)?(?:\s|$)/i, TG_CALLBACK.SYNC_SHEETS)
    route(/^\/api_health(?:@\w+)?(?:\s|$)/i, TG_CALLBACK.API_HEALTH)
    route(/^\/status(?:@\w+)?(?:\s|$)/i, 'status')
    route(/^\/orders(?:@\w+)?(?:\s|$)/i, 'orders')
    route(/^\/link_group(?:@\w+)?(?:\s|$)/i, TG_CALLBACK.LINK_GROUP)
    route(/^\/group_info(?:@\w+)?(?:\s|$)/i, TG_CALLBACK.GROUP_INFO)
    route(/^\/chat_id(?:@\w+)?(?:\s|$)/i, TG_CALLBACK.GROUP_INFO)

    this.bot.onText(/^\/login(?:@\w+)?(?:\s+(.+))?$/i, async (msg, match) => {
      const ctx = await this.resolveContext(msg)
      if (!ctx) return
      const tokenArg = match?.[1]?.trim()
      if (tokenArg) {
        await this.executeLoginWithToken(ctx, tokenArg, msg.from?.username)
        return
      }
      await this.executeAdminLogin(ctx)
    })

    this.bot.onText(/\/order (.+)/i, async (msg, match) => {
      const ctx = await this.resolveContext(msg)
      if (!ctx) return
      const invoice = match?.[1]?.trim()
      if (!invoice) return
      await this.replyOrderTrack(ctx.chatId, invoice, ctx.storeId)
      await this.logCommand(ctx.chatId, `/order ${invoice}`, ctx.userId)
    })

    this.bot.onText(/\/invoice(?:@\w+)?(?:\s+(.+)|$)/i, async (msg, match) => {
      const ctx = await this.resolveContext(msg)
      if (!ctx) return
      const invoice = match?.[1]?.trim()
      await this.executeInvoice(ctx, invoice)
    })

    this.bot.onText(/\/check(?:@\w+)?(?:\s+(.+)|$)/i, async (msg, match) => {
      const ctx = await this.resolveContext(msg)
      if (!ctx) return
      const phoneArg = match?.[1]?.trim()
      await this.executePhoneCheck(ctx, phoneArg)
    })

    this.bot.onText(/\/confirm(?:@\w+)?(?:\s+(.+)|_order\s+(.+))/i, async (msg, match) => {
      const ctx = await this.resolveContext(msg)
      if (!ctx) return
      const invoice = (match?.[1] ?? match?.[2])?.trim()
      if (!invoice) return
      await this.executeConfirmOrder(ctx, invoice)
    })

    this.bot.onText(/\/courier(?:@\w+)?(?:\s+(.+)|_order\s+(.+)|$)/i, async (msg, match) => {
      const ctx = await this.resolveContext(msg)
      if (!ctx) return
      const invoice = (match?.[1] ?? match?.[2])?.trim()
      if (!invoice) {
        await this.bot?.sendMessage(ctx.chatId, 'Usage: <code>/courier SPL-1001</code>', { parse_mode: 'HTML' })
        return
      }
      await this.executeBookCourier(ctx, invoice)
    })

    this.bot.onText(/\/cancel(?:@\w+)?(?:\s+(.+)|_order\s+(.+))/i, async (msg, match) => {
      const ctx = await this.resolveContext(msg)
      if (!ctx) return
      const invoice = (match?.[1] ?? match?.[2])?.trim()
      if (!invoice) return
      await this.executeCancelOrder(ctx, invoice)
    })

    this.bot.onText(/\/book_courier (.+)/i, async (msg, match) => {
      const ctx = await this.resolveContext(msg)
      if (!ctx) return
      const invoice = match?.[1]?.trim()
      if (!invoice) return
      await this.executeBookCourier(ctx, invoice)
    })

    this.bot.onText(/\/confirm_order (.+)/i, async (msg, match) => {
      const ctx = await this.resolveContext(msg)
      if (!ctx) return
      const invoice = match?.[1]?.trim()
      if (!invoice) return
      await this.executeConfirmOrder(ctx, invoice)
    })

    for (const slug of ['sourove', 'raju', 'hridoy'] as const) {
      this.bot.onText(new RegExp(`/partner_${slug}`, 'i'), async (msg) => {
        const ctx = await this.resolveContext(msg)
        if (!ctx) return
        if (!(await this.checkUserPermission(ctx.userId, ['SUPER_ADMIN', 'MANAGER', 'FINANCE_STAFF', 'PARTNER'], ctx.configId))) {
          await this.bot?.sendMessage(ctx.chatId, '❌ Unauthorized')
          return
        }
        const partner = await this.prisma.partner.findFirst({ where: { storeId: ctx.storeId, slug } })
        if (!partner) {
          await this.bot?.sendMessage(ctx.chatId, '❌ Partner not found')
          return
        }
        await this.bot?.sendMessage(
          ctx.chatId,
          `👤 <b>Partner: ${partner.name}</b>\n💰 Balance: <b>${formatBDT(Number(partner.currentBalance))}</b>\n📈 Investment: ${formatBDT(Number(partner.totalInvestment))}\n📤 Withdrawals: ${formatBDT(Number(partner.totalWithdrawal))}\n📊 Profit Share: ${formatBDT(Number(partner.totalProfitShare))}\n📐 Share: ${Number(partner.sharePercent)}%`,
          { parse_mode: 'HTML' },
        )
      })
    }

    this.bot.onText(/\/customer (.+)/i, async (msg, match) => {
      const ctx = await this.resolveContext(msg)
      if (!ctx) return
      const phone = match?.[1]?.trim()
      if (!phone) return
      const customer = await this.prisma.customer.findFirst({
        where: { storeId: ctx.storeId, phone: { contains: phone } },
      })
      if (!customer) {
        await this.bot?.sendMessage(ctx.chatId, '❌ Customer not found')
        return
      }
      await this.bot?.sendMessage(
        ctx.chatId,
        `👤 ${customer.firstName} ${customer.lastName}\n📞 ${customer.phone}\n📦 Orders: ${customer.totalOrders}`,
        { parse_mode: 'HTML' },
      )
    })

    this.bot.onText(/\/stock (.+)/i, async (msg, match) => {
      const ctx = await this.resolveContext(msg)
      if (!ctx) return
      const sku = match?.[1]?.trim()?.toUpperCase()
      if (!sku) return
      const variant = await this.prisma.productVariant.findFirst({
        where: { sku: { equals: sku, mode: 'insensitive' } },
        include: { product: { select: { name: true } } },
      })
      if (!variant) {
        await this.bot?.sendMessage(ctx.chatId, `❌ SKU ${sku} not found`)
        return
      }
      await this.bot?.sendMessage(
        ctx.chatId,
        `📦 ${variant.product.name}\nSKU: ${variant.sku}\nStock: <b>${variant.stock}</b>`,
        { parse_mode: 'HTML' },
      )
    })

    this.bot.on('callback_query', async (query) => {
      const msg = query.message
      if (!msg) return
      const chatId = msg.chat.id.toString()
      const userId = query.from.id.toString()
      const data = query.data ?? ''
      const ctx = await this.resolveContextFromIds(chatId, userId)
      if (!ctx) {
        await this.bot?.answerCallbackQuery(query.id, { text: 'Store not configured', show_alert: true })
        return
      }

      const orderAction = parseOrderCallback(data)
      if (orderAction) {
        await this.bot?.answerCallbackQuery(query.id)
        if (orderAction.action === 'track') {
          await this.replyOrderTrack(ctx.chatId, orderAction.invoice, ctx.storeId)
        } else if (orderAction.action === 'confirm') {
          await this.executeConfirmOrder(ctx, orderAction.invoice)
        } else {
          await this.executeBookCourier(ctx, orderAction.invoice)
        }
        return
      }

      const listAction = parseListCallback(data)
      if (listAction) {
        await this.bot?.answerCallbackQuery(query.id)
        if (listAction.kind === 'orders') {
          await this.executeOrdersList(ctx, listAction.page)
        }
        return
      }

      if (data === 'agent:confirm' || data === 'agent:cancel') {
        await this.bot?.answerCallbackQuery(query.id, {
          text: data === 'agent:confirm' ? 'Confirming…' : 'Cancelled',
        })
        await this.replyAgentChat(chatId, data === 'agent:confirm' ? 'confirm' : 'cancel', userId)
        return
      }

      await this.bot?.answerCallbackQuery(query.id)
      await this.executeAction(data, ctx, msg, query.from.first_name)
    })

    this.bot.on('my_chat_member', async (member) => {
      if (!member || member.new_chat_member.status === 'kicked' || member.new_chat_member.status === 'left') return
      const chat = member.chat
      const chatId = chat.id.toString()
      const isGroup = chat.type === 'group' || chat.type === 'supergroup'
      if (!isGroup) return

      const title = 'title' in chat ? chat.title : 'Group'
      await this.bot?.sendMessage(
        chatId,
        `👋 <b>SPLARO Bot joined ${title}</b>\n\n1. Make bot <b>admin</b> in this group\n2. Super admin sends <code>/link_group</code>\n3. In BotFather: <code>/setprivacy</code> → <b>Disable</b> (so bot reads order numbers & AI messages)\n\nThen all alerts & buttons work here.`,
        { parse_mode: 'HTML', reply_markup: inlineMainMenu() },
      )
    })

    this.bot.on('message', async (msg) => {
      if (!msg.text || msg.text.startsWith('/')) return
      const text = msg.text.trim()
      if (!text) return

      const ctx = await this.resolveContext(msg)
      if (!ctx) return

      const routeKey = resolveTelegramButtonRoute(text)
      if (routeKey) {
        if (isStaleTelegramKeyboardLabel(text)) {
          await this.bot?.sendMessage(ctx.chatId, '✅ Menu refreshed — use the buttons below.', {
            reply_markup: mainReplyKeyboard(),
          })
        }
        if (routeKey === TG_CALLBACK.MENU_MAIN) {
          await this.sendWelcome(ctx, msg.from?.first_name)
        } else {
          await this.executeAction(routeKey, ctx, msg, msg.from?.first_name)
        }
        return
      }

      const invoiceNumber = text.toUpperCase()
      if (/^SPL-\d+/.test(invoiceNumber)) {
        await this.replyOrderTrack(ctx.chatId, invoiceNumber, ctx.storeId)
        return
      }

      if (
        !shouldRouteUnmatchedTextToAi({
          aiMode: this.aiModeChats.has(ctx.chatId),
          isGroup: ctx.isGroup,
        })
      ) {
        if (!ctx.isGroup) {
          const latest = await this.latestInvoiceNumber(ctx.storeId)
          await this.bot?.sendMessage(ctx.chatId, telegramOpsHint(latest), {
            reply_markup: mainReplyKeyboard(),
          })
        }
        return
      }

      await this.replyAgentChat(ctx.chatId, text, ctx.userId)
    })

    this.logger.log('Telegram commands registered')
  }

  private setAiMode(chatId: string, on: boolean): void {
    if (on) this.aiModeChats.add(chatId)
    else this.aiModeChats.delete(chatId)
  }

  private async sendWelcome(ctx: TelegramCtx, firstName?: string): Promise<void> {
    this.setAiMode(ctx.chatId, false)
    const config = await this.prisma.telegramConfig.findUnique({ where: { id: ctx.configId } })
    const linked = config?.chatId === ctx.chatId
    await this.sendHtmlWithPlainFallback(
      ctx.chatId,
      welcomeMessage({ name: firstName, isGroup: ctx.isGroup, storeLinked: linked }),
      { reply_markup: mainReplyKeyboard() },
    )
    await this.bot?.sendMessage(ctx.chatId, menuMessage(), {
      parse_mode: 'HTML',
      reply_markup: inlineMainMenu(),
    })
  }

  private async executeAction(
    action: string,
    ctx: TelegramCtx,
    msg: Message,
    firstName?: string,
  ): Promise<void> {
    this.setAiMode(ctx.chatId, isTelegramAiAction(action))
    switch (action) {
      case TG_CALLBACK.MENU_MAIN:
        await this.sendWelcome(ctx, firstName ?? msg.from?.first_name)
        break
      case TG_CALLBACK.MENU_ORDERS:
        await this.bot?.sendMessage(
          ctx.chatId,
          `${premiumHeader('Orders Hub', 'Daily order flow, queues, sales, and drill-down lists.')}`,
          {
            parse_mode: 'HTML',
            reply_markup: inlineOrdersMenu(),
          },
        )
        break
      case TG_CALLBACK.MENU_COURIER:
        await this.bot?.sendMessage(
          ctx.chatId,
          `${premiumHeader('Courier Hub', 'Booking status, pending queue, delivery logs, and quick actions.')}`,
          {
            parse_mode: 'HTML',
            reply_markup: inlineCourierMenu(),
          },
        )
        break
      case TG_CALLBACK.MENU_FINANCE:
        if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER', 'FINANCE_STAFF', 'PARTNER']))) return
        await this.bot?.sendMessage(
          ctx.chatId,
          `${premiumHeader('Finance Hub', 'Revenue, profit, expenses, and reporting shortcuts.')}`,
          {
            parse_mode: 'HTML',
            reply_markup: inlineFinanceMenu(),
          },
        )
        break
      case TG_CALLBACK.MENU_INVENTORY:
        if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER', 'ORDER_STAFF']))) return
        await this.bot?.sendMessage(
          ctx.chatId,
          `${premiumHeader('Inventory Desk', 'Low stock watch, SKU lookup, and stock health snapshots.')}`,
          {
            parse_mode: 'HTML',
            reply_markup: inlineInventoryMenu(),
          },
        )
        break
      case TG_CALLBACK.MENU_ADMIN:
        await this.bot?.sendMessage(
          ctx.chatId,
          `${premiumHeader('Admin Desk', 'Login delivery, linked admins, chat diagnostics, and bot health.')}`,
          {
            parse_mode: 'HTML',
            reply_markup: inlineAdminMenu(),
          },
        )
        break
      case TG_CALLBACK.MENU_AI:
        if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER', 'ORDER_STAFF']))) return
        await this.bot?.sendMessage(
          ctx.chatId,
          `${premiumHeader('AI Assistant', 'Run prepared ops prompts or type your own question below.')}`,
          {
            parse_mode: 'HTML',
            reply_markup: inlineAiMenu(),
          },
        )
        break
      case TG_CALLBACK.STATUS_SUMMARY:
        await this.executeStatus(ctx)
        break
      case TG_CALLBACK.COURIER_SNAPSHOT:
        await this.executeCourierSnapshot(ctx)
        break
      case TG_CALLBACK.INVENTORY_SNAPSHOT:
        await this.executeInventorySnapshot(ctx)
        break
      case TG_CALLBACK.INVENTORY_LOOKUP_HELP:
        await this.executeInventoryLookupHelp(ctx)
        break
      case TG_CALLBACK.DELIVERY_DIAGNOSTICS:
        await this.executeDeliveryDiagnostics(ctx)
        break
      case TG_CALLBACK.LINKED_ADMINS:
        await this.executeLinkedAdmins(ctx)
        break
      case TG_CALLBACK.ORDERS_LIST:
        if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER', 'ORDER_STAFF']))) return
        await this.executeOrdersList(ctx, 0)
        break
      case TG_CALLBACK.ORDERS_TODAY:
        if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER', 'ORDER_STAFF']))) return
        await this.executeTodayOrders(ctx)
        break
      case TG_CALLBACK.SALES_TODAY:
        if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER']))) return
        await this.executeTodaySales(ctx)
        break
      case TG_CALLBACK.PENDING:
        await this.executePendingOrders(ctx)
        break
      case TG_CALLBACK.LOW_STOCK:
        await this.executeLowStock(ctx)
        break
      case TG_CALLBACK.DELIVERED_TODAY:
        await this.executeDeliveredToday(ctx)
        break
      case TG_CALLBACK.REPORT_TODAY:
        await this.sendDailyReport(ctx.storeId)
        break
      case TG_CALLBACK.PROFIT_TODAY:
        if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER', 'FINANCE_STAFF', 'PARTNER']))) return
        await this.bot?.sendMessage(ctx.chatId, await this.getProfitSummary(ctx.storeId, 'today'), { parse_mode: 'HTML' })
        break
      case TG_CALLBACK.PROFIT_MONTH:
        if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER', 'FINANCE_STAFF', 'PARTNER']))) return
        await this.bot?.sendMessage(ctx.chatId, await this.getProfitSummary(ctx.storeId, 'month'), { parse_mode: 'HTML' })
        break
      case TG_CALLBACK.EXPENSES_TODAY:
        if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER', 'FINANCE_STAFF']))) return
        await this.executeExpensesToday(ctx)
        break
      case TG_CALLBACK.SYNC_SHEETS:
        if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER', 'FINANCE_STAFF']))) return
        await this.bot?.sendMessage(ctx.chatId, '📊 Google Sheets sync queued. Check admin Sync Logs.')
        await this.logCommand(ctx.chatId, '/sync_sheets', ctx.userId)
        break
      case TG_CALLBACK.AI_PROMPT_SALES:
      case TG_CALLBACK.AI_PROMPT_RISK:
      case TG_CALLBACK.AI_PROMPT_STOCK:
        if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER', 'ORDER_STAFF']))) return
        await this.bot?.sendMessage(ctx.chatId, `Running ${aiPromptLabel(action)}…`)
        await this.replyAgentChat(ctx.chatId, aiPromptForAction(action) ?? '', ctx.userId)
        break
      case TG_CALLBACK.API_HEALTH:
        await this.executeApiHealth(ctx)
        break
      case TG_CALLBACK.ADMIN_LOGIN:
        await this.executeAdminLogin(ctx)
        break
      case TG_CALLBACK.LINK_GROUP:
        await this.executeLinkGroup(ctx)
        break
      case TG_CALLBACK.GROUP_INFO:
        await this.executeGroupInfo(ctx)
        break
      case 'help':
        await this.bot?.sendMessage(ctx.chatId, menuMessage(), {
          parse_mode: 'HTML',
          reply_markup: inlineMainMenu(),
        })
        break
      case 'status':
        await this.executeStatus(ctx)
        break
      case 'orders':
        await this.executeOrdersList(ctx)
        break
      default:
        break
    }
  }

  private async requireRoles(ctx: TelegramCtx, roles: TelegramRole[]): Promise<boolean> {
    const ok = await this.checkUserPermission(ctx.userId, roles, ctx.configId)
    if (!ok) await this.bot?.sendMessage(ctx.chatId, '❌ Unauthorized for this action')
    return ok
  }

  private async executeTodayOrders(ctx: TelegramCtx): Promise<void> {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const count = await this.prisma.order.count({ where: { storeId: ctx.storeId, createdAt: { gte: today } } })
    await this.bot?.sendMessage(
      ctx.chatId,
      `📦 <b>Today's Orders</b>\n━━━━━━━━━━━━━━━━━━━━\nCount: <b>${count}</b>\nStatus: ${count > 0 ? 'Live order flow detected' : 'No new orders yet'}`,
      { parse_mode: 'HTML', reply_markup: inlineOrdersMenu() },
    )
    await this.logCommand(ctx.chatId, '/today_orders', ctx.userId)
  }

  private async executeTodaySales(ctx: TelegramCtx): Promise<void> {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const agg = await this.prisma.order.aggregate({
      where: { storeId: ctx.storeId, createdAt: { gte: today }, status: { not: 'CANCELLED' } },
      _sum: { total: true },
      _count: true,
    })
    await this.bot?.sendMessage(
      ctx.chatId,
      `💰 <b>Today's Sales</b>\n━━━━━━━━━━━━━━━━━━━━\nOrders: <b>${agg._count}</b>\nRevenue: <b>${formatBDT(Number(agg._sum.total ?? 0))}</b>`,
      { parse_mode: 'HTML', reply_markup: inlineOrdersMenu() },
    )
    await this.logCommand(ctx.chatId, '/today_sales', ctx.userId)
  }

  private async executePendingOrders(ctx: TelegramCtx): Promise<void> {
    const count = await this.prisma.order.count({ where: { storeId: ctx.storeId, status: 'PENDING' } })
    await this.bot?.sendMessage(
      ctx.chatId,
      `⏳ <b>Pending Orders</b>\n━━━━━━━━━━━━━━━━━━━━\nCount: <b>${count}</b>\nAction: ${count > 0 ? 'Review confirmations / courier' : 'Queue is clear'}`,
      { parse_mode: 'HTML', reply_markup: inlineOrdersMenu() },
    )
  }

  private async executeLowStock(ctx: TelegramCtx): Promise<void> {
    const variants = await this.prisma.productVariant.findMany({
      where: { product: { storeId: ctx.storeId, isPublished: true }, stock: { lte: 5 }, isActive: true },
      include: { product: { select: { name: true } } },
      take: 10,
      orderBy: { stock: 'asc' },
    })
    if (variants.length === 0) {
      await this.bot?.sendMessage(ctx.chatId, '✅ No low stock items found', { reply_markup: inlineOrdersMenu() })
      return
    }
    const list = variants
      .map((v) => `• ${v.product.name} (${[v.size, v.color].filter(Boolean).join(' ').trim()}): <b>${v.stock}</b>`)
      .join('\n')
    await this.bot?.sendMessage(
      ctx.chatId,
      `⚠️ <b>Low Stock (${variants.length})</b>\n━━━━━━━━━━━━━━━━━━━━\n${list}`,
      { parse_mode: 'HTML', reply_markup: inlineOrdersMenu() },
    )
  }

  private async executeDeliveredToday(ctx: TelegramCtx): Promise<void> {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const count = await this.prisma.order.count({
      where: { storeId: ctx.storeId, status: 'DELIVERED', deliveredAt: { gte: today } },
    })
    await this.bot?.sendMessage(
      ctx.chatId,
      `✅ <b>Delivered Today</b>\n━━━━━━━━━━━━━━━━━━━━\nCount: <b>${count}</b>`,
      { parse_mode: 'HTML', reply_markup: inlineOrdersMenu() },
    )
  }

  private async executeExpensesToday(ctx: TelegramCtx): Promise<void> {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const agg = await this.prisma.expense.aggregate({
      where: { storeId: ctx.storeId, expenseDate: { gte: today }, status: 'APPROVED' },
      _sum: { amount: true },
      _count: true,
    })
    await this.bot?.sendMessage(
      ctx.chatId,
      `💸 <b>Expenses Today</b>\n━━━━━━━━━━━━━━━━━━━━\nTotal: <b>${formatBDT(Number(agg._sum.amount ?? 0))}</b>\nEntries: ${agg._count}`,
      { parse_mode: 'HTML', reply_markup: inlineFinanceMenu() },
    )
  }

  private async executeApiHealth(ctx: TelegramCtx): Promise<void> {
    const latest = await this.prisma.systemHealthLog.findFirst({
      where: { service: 'api' },
      orderBy: { checkedAt: 'desc' },
    })
    const status = latest?.status ?? 'UP'
    const emoji = status === 'UP' ? '🟢' : '🔴'
    await this.bot?.sendMessage(
      ctx.chatId,
      `${emoji} <b>API Health: ${status}</b>${latest?.responseMs ? `\nResponse: ${latest.responseMs}ms` : ''}\n\n<i>SPLARO API connected</i>`,
      { parse_mode: 'HTML', reply_markup: inlineAdminMenu() },
    )
  }

  private async executeAdminLogin(ctx: TelegramCtx): Promise<void> {
    const linked = await this.checkUserPermission(ctx.userId, ['SUPER_ADMIN', 'MANAGER'], ctx.configId)
    if (!linked) {
      await this.bot?.sendMessage(
        ctx.chatId,
        `🔐 <b>Admin login</b>\n\nYour Telegram is not linked yet.\n\n1. Open Admin → Telegram Bot\n2. Tap <b>Generate link token</b>\n3. Send here:\n<code>/login XXXX-XXXX</code>\n\nThen request login from the admin panel.`,
        { parse_mode: 'HTML' },
      )
      return
    }

    try {
      const auth = this.moduleRef.get(AuthService, { strict: false })
      const { code, email } = await auth.issueTelegramLoginToken(ctx.storeId)
      const sent = await this.sendLoginTokenForAdmin(ctx.storeId, email, code)
      if (sent) {
        await this.logCommand(ctx.chatId, '/login', ctx.userId)
      } else {
        const displayCode = formatLoginTokenDisplay(code)
        await this.bot?.sendMessage(
          ctx.chatId,
          `❌ Could not deliver login token.\n\nToken: <code>${displayCode}</code>\n\nCopy and paste at ${this.adminLoginUrl()}`,
          { parse_mode: 'HTML', reply_markup: loginCopyKeyboard(displayCode) },
        )
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Token generation failed'
      await this.bot?.sendMessage(ctx.chatId, `❌ ${errMsg}`)
    }
  }

  /** Link admin Telegram via one-time token from admin panel, then confirm. */
  private async executeLoginWithToken(
    ctx: TelegramCtx,
    rawToken: string,
    username?: string,
  ): Promise<void> {
    const loginTokens = this.moduleRef.get(AdminLoginTokenService, { strict: false })
    const record = await loginTokens.peekByCode(rawToken)
    if (!record) {
      await this.bot?.sendMessage(
        ctx.chatId,
        '❌ Invalid, expired, or already used token.\n\nGenerate a new link token in Admin → Telegram Bot.',
        { parse_mode: 'HTML' },
      )
      return
    }

    if (record.storeId !== ctx.storeId) {
      await this.bot?.sendMessage(ctx.chatId, '❌ This token belongs to a different store.')
      return
    }

    const telegramRole = mapStaffRoleToTelegram(record.role)
    await this.prisma.telegramUser.upsert({
      where: { configId_telegramId: { configId: ctx.configId, telegramId: ctx.userId } },
      create: {
        configId: ctx.configId,
        telegramId: ctx.userId,
        username: username ?? null,
        role: telegramRole,
        isActive: true,
      },
      update: {
        username: username ?? null,
        role: telegramRole,
        isActive: true,
      },
    })

    await this.prisma.user.update({
      where: { id: record.userId },
      data: {
        telegramId: ctx.userId,
        telegramUsername: username ?? null,
        twoFAEnabled: true,
      },
    })

    await this.bot?.sendMessage(
      ctx.chatId,
      `✅ <b>Telegram linked</b>\n\nAccount: <code>${record.email}</code>\nRole: ${telegramRole.replace(/_/g, ' ')}\n\nYou can now receive admin login tokens here.\nUse /login for a fresh panel token.`,
      { parse_mode: 'HTML', reply_markup: inlineMainMenu() },
    )
    await this.logCommand(ctx.chatId, '/login link', ctx.userId)
  }

  /** Push admin login token to linked Telegram chat(s) — used by /login and admin request-login. */
  /** Resolve where to deliver a login OTP — per-user binding only (no shared group broadcast). */
  async resolveAdminLoginDelivery(
    storeIdRaw: string,
    email: string,
  ): Promise<{ ok: true; chatIds: string[] } | { ok: false; message: string }> {
    const normalizedEmail = email.trim().toLowerCase()
    const envAdminEmail = this.config.get<string>('ADMIN_EMAIL')?.trim().toLowerCase()
    const envTelegramId = this.config.get<string>('TELEGRAM_ADMIN_USER_ID')?.trim()
    const isPrimaryOwner = Boolean(envAdminEmail && envAdminEmail === normalizedEmail)

    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, isActive: true },
      select: { telegramId: true },
    })

    const chatIds = new Set<string>()
    if (user?.telegramId?.trim()) chatIds.add(user.telegramId.trim())
    if (envTelegramId && isPrimaryOwner) chatIds.add(envTelegramId)

    if (chatIds.size > 0) {
      // Persist the env fallback so the owner stays reachable even if TELEGRAM_ADMIN_USER_ID is dropped.
      if (isPrimaryOwner && !user?.telegramId?.trim() && envTelegramId) {
        await this.prisma.user.updateMany({
          where: { email: normalizedEmail, isActive: true },
          data: { telegramId: envTelegramId, twoFAEnabled: true },
        })
      }
      return { ok: true, chatIds: [...chatIds] }
    }

    // Primary owner safety net — recover from TelegramUser / config when User.telegramId was cleared.
    if (isPrimaryOwner) {
      try {
        const storeId = await resolveStoreId(this.prisma, storeIdRaw)
        const tgUser = await this.prisma.telegramUser.findFirst({
          where: { isActive: true, role: 'SUPER_ADMIN', config: { storeId, isActive: true } },
          orderBy: { createdAt: 'asc' },
          select: { telegramId: true, username: true },
        })
        const cfg = await this.prisma.telegramConfig.findFirst({
          where: { storeId, isActive: true },
          select: { chatId: true },
        })
        const chatId = tgUser?.telegramId?.trim() || cfg?.chatId?.trim() || null
        if (chatId) {
          await this.prisma.user.updateMany({
            where: { email: normalizedEmail, isActive: true },
            data: {
              telegramId: chatId,
              ...(tgUser?.username ? { telegramUsername: tgUser.username } : {}),
              twoFAEnabled: true,
            },
          })
          this.logger.warn(`Auto-relinked primary admin Telegram (${normalizedEmail} → ${chatId})`)
          return { ok: true, chatIds: [chatId] }
        }
      } catch (err) {
        this.logger.warn(
          `Primary admin Telegram auto-relink failed: ${err instanceof Error ? err.message : 'unknown'}`,
        )
      }

      return {
        ok: false,
        message:
          'Owner Telegram is not configured. Set TELEGRAM_ADMIN_USER_ID in server .env or link your Telegram via Admin → Telegram Bot.',
      }
    }

    return {
      ok: false,
      message:
        'Your Telegram is not linked for login. Ask an owner to link your Telegram in Security → Admin Users, or generate a link token from your profile.',
    }
  }

  async sendLoginTokenForAdmin(storeIdRaw: string, email: string, code: string): Promise<boolean> {
    if (!this.bot) {
      this.recordDeliveryFailure('Bot not running — configure TELEGRAM_BOT_TOKEN or save token in Admin → Telegram Bot')
      this.logger.warn('Telegram bot disabled — admin login token not delivered')
      return false
    }

    try {
      const delivery = await this.resolveAdminLoginDelivery(storeIdRaw, email)
      if (!delivery.ok) {
        this.recordDeliveryFailure(delivery.message)
        this.logger.warn(`Admin login OTP blocked (${email}): ${delivery.message}`)
        return false
      }
      const chatIds = delivery.chatIds
      if (!chatIds.length) {
        this.recordDeliveryFailure('No linked admin Telegram chat — open bot and send /login TOKEN from Admin panel link token')
        this.logger.warn(`No Telegram chat linked for admin login (${email})`)
        return false
      }

      const adminUrl = this.adminLoginUrl()
      const displayCode = formatLoginTokenDisplay(code)
      const htmlMessage =
        `┌──────────────────────────┐\n` +
        `│  🔐 <b>SPLARO Admin Login</b>     │\n` +
        `└──────────────────────────┘\n\n` +
        `👤 Email: <code>${email}</code>\n` +
        `🎟 Token: <code>${displayCode}</code>\n\n` +
        `⏱ Valid for <b>10 minutes</b> · one-time use\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📋 Tap <b>Copy Login Token</b> → paste → Verify\n` +
        `<i>${adminUrl}</i>`
      const plainMessage =
        `SPLARO Admin Login\n\n` +
        `Email: ${email}\n` +
        `Token: ${displayCode}\n\n` +
        `Valid 10 min · one-time\n` +
        `Copy → paste → Verify at ${adminUrl}`

      let delivered = 0
      for (const chatId of chatIds) {
        const ok = await this.sendLoginTokenToChat(chatId, htmlMessage, plainMessage, displayCode)
        if (ok) delivered += 1
      }

      if (delivered === 0) {
        this.recordDeliveryFailure(`Telegram sendMessage failed for chat(s): ${chatIds.join(',')}`)
        this.logger.error(`Admin login token delivery failed for ${email} → ${chatIds.join(',')}`)
        return false
      }

      this.logger.log(`Admin login token delivered to ${delivered}/${chatIds.length} chat(s) for ${email}`)
      this.recordDeliverySuccess()
      return true
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'sendMessage failed'
      this.recordDeliveryFailure(errMsg)
      this.logger.error(`Admin login token delivery failed: ${errMsg}`)
      return false
    }
  }

  /** HTML + copy button first; plain text fallback so OTP still lands if markup is rejected. */
  private async sendLoginTokenToChat(
    chatId: string,
    htmlMessage: string,
    plainMessage: string,
    code: string,
  ): Promise<boolean> {
    if (!this.bot) return false
    try {
      await this.bot.sendMessage(chatId, htmlMessage, {
        parse_mode: 'HTML',
        reply_markup: loginCopyKeyboard(code),
      })
      return true
    } catch (err) {
      this.logger.warn(
        `Login OTP HTML/keyboard send failed (${chatId}): ${err instanceof Error ? err.message : 'unknown'} — retrying plain`,
      )
    }
    try {
      await this.bot.sendMessage(chatId, plainMessage)
      return true
    } catch (err) {
      this.logger.error(
        `Login OTP plain send failed (${chatId}): ${err instanceof Error ? err.message : 'unknown'}`,
      )
      return false
    }
  }

  async getLoginDeliveryDiagnostics(storeIdRaw: string, email: string): Promise<TelegramDeliveryDiagnostics> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    if (!this.bot) {
      const token = await this.resolveBotToken()
      if (!token) {
        return {
          ok: false,
          reason: 'Bot token not configured',
          hint: 'Set TELEGRAM_BOT_TOKEN in env or save bot token in Admin → Telegram Bot.',
        }
      }
      return {
        ok: false,
        reason: 'Bot failed to start',
        hint: 'Check API logs for Telegram init errors (invalid token, webhook conflict).',
      }
    }

    const delivery = await this.resolveAdminLoginDelivery(storeIdRaw, email)
    if (!delivery.ok) {
      return {
        ok: false,
        reason: delivery.message,
        hint: 'Link your personal Telegram in Security → Admin Users, then retry login.',
      }
    }

    return { ok: true, reason: 'Delivery targets available', hint: 'Retry login from admin panel.' }
  }

  async getHealth(storeIdRaw: string): Promise<TelegramHealthSnapshot> {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const config = await this.prisma.telegramConfig.findUnique({
      where: { storeId },
      include: {
        users: {
          where: { isActive: true, role: { in: ['SUPER_ADMIN', 'MANAGER'] } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    const tokenConfigured = this.botTokenSource !== 'none' || Boolean(await this.resolveBotToken())
    const webhookUrl = this.config.get<string>('TELEGRAM_WEBHOOK_URL')?.trim() || null
    const pollingEnv = this.config.get<string>('SPLARO_TELEGRAM_POLLING')
    let transportMode: TelegramHealthSnapshot['transportMode'] = 'disabled'
    if (this.bot) {
      if (webhookUrl) transportMode = 'webhook'
      else if (pollingEnv !== '0') transportMode = 'polling'
      else transportMode = 'send-only'
    }

    let botUsername: string | null = null
    let webhookRegistered = false
    let networkVerified = false

    if (this.bot) {
      try {
        const me = await this.bot.getMe()
        botUsername = me.username ?? null
        networkVerified = true
        if (webhookUrl) {
          const info = await this.bot.getWebHookInfo()
          webhookRegistered = (info.url?.replace(/\/$/, '') ?? '') === webhookUrl.replace(/\/$/, '')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'getMe failed'
        this.logger.warn(`Telegram health check network error: ${msg}`)
      }
    }

    const linkedAdmins = (config?.users ?? []).map((u) => ({
      id: u.id,
      telegramIdMasked: maskTelegramId(u.telegramId),
      username: u.username,
      role: u.role,
    }))

    return {
      botTokenConfigured: tokenConfigured,
      botTokenSource: this.botTokenSource,
      botRunning: Boolean(this.bot),
      botUsername,
      transportMode,
      webhookUrl,
      webhookRegistered,
      linkedAdminCount: linkedAdmins.length,
      linkedAdmins,
      configChatIdMasked: config?.chatId ? maskTelegramId(config.chatId) : null,
      hasLinkedAdminChat: linkedAdmins.length > 0 || Boolean(config?.chatId),
      lastDeliveryStatus: this.lastDeliveryStatus,
      lastDeliveryError: this.lastDeliveryError,
      lastDeliveryAt: this.lastDeliveryAt?.toISOString() ?? null,
      networkVerified,
    }
  }

  private recordDeliverySuccess(): void {
    this.lastDeliveryStatus = 'success'
    this.lastDeliveryError = null
    this.lastDeliveryAt = new Date()
  }

  private recordDeliveryFailure(message: string): void {
    this.lastDeliveryStatus = 'failed'
    this.lastDeliveryError = message
    this.lastDeliveryAt = new Date()
  }

  private shouldSendNotification(key: string, ttlMs = 60_000): boolean {
    const now = Date.now()
    const last = this.notificationDedupe.get(key)
    if (last && now - last < ttlMs) return false
    this.notificationDedupe.set(key, now)
    if (this.notificationDedupe.size > 500) {
      for (const [k, ts] of this.notificationDedupe) {
        if (now - ts > ttlMs) this.notificationDedupe.delete(k)
      }
    }
    return true
  }

  private async executeStatus(ctx: TelegramCtx): Promise<void> {
    if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER', 'ORDER_STAFF']))) return

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [pending, todayOrders, todayRevenue, latestHealth] = await Promise.all([
      this.prisma.order.count({ where: { storeId: ctx.storeId, status: 'PENDING' } }),
      this.prisma.order.count({ where: { storeId: ctx.storeId, createdAt: { gte: today } } }),
      this.prisma.order.aggregate({
        where: { storeId: ctx.storeId, createdAt: { gte: today }, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }),
      this.prisma.systemHealthLog.findFirst({ where: { service: 'api' }, orderBy: { checkedAt: 'desc' } }),
    ])

    const apiStatus = latestHealth?.status ?? 'UP'
    const apiEmoji = apiStatus === 'UP' ? '🟢' : '🔴'
    const botOk = Boolean(this.bot)

    await this.bot?.sendMessage(
      ctx.chatId,
      `${premiumHeader('SPLARO Live Status')}\n${apiEmoji} API: <b>${apiStatus}</b>${latestHealth?.responseMs ? ` (${latestHealth.responseMs}ms)` : ''}\nBot: ${botOk ? 'Running' : 'Disabled'}\n\nOrders today: <b>${todayOrders}</b>\nRevenue: <b>${formatBDT(Number(todayRevenue._sum.total ?? 0))}</b>\nPending: <b>${pending}</b>`,
      { parse_mode: 'HTML', reply_markup: inlineMainMenu() },
    )
    await this.logCommand(ctx.chatId, '/status', ctx.userId)
  }

  private async executeOrdersList(ctx: TelegramCtx, page = 0): Promise<void> {
    if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER', 'ORDER_STAFF']))) return

    const orders = await this.prisma.order.findMany({
      where: { storeId: ctx.storeId },
      orderBy: { createdAt: 'desc' },
      skip: Math.max(0, page) * 5,
      take: 6,
      select: {
        invoiceNumber: true,
        status: true,
        total: true,
        shippingName: true,
        createdAt: true,
      },
    })

    if (!orders.length) {
      await this.bot?.sendMessage(ctx.chatId, '📦 No orders yet.')
      return
    }

    const hasMore = orders.length > 5
    const lines = orders
      .slice(0, 5)
      .map(
        (o) =>
          `• <code>${o.invoiceNumber}</code> · ${o.status.replace(/_/g, ' ')} · ${formatBDT(Number(o.total))}\n  ${o.shippingName}`,
      )
      .join('\n')

    await this.bot?.sendMessage(
      ctx.chatId,
      `${premiumHeader(`Latest Orders · Page ${page + 1}`)}\n${lines}\n\n<i>/order SPL-1001 for details</i>`,
      { parse_mode: 'HTML', reply_markup: orderListKeyboard(page, hasMore) },
    )
    await this.logCommand(ctx.chatId, '/orders', ctx.userId)
  }

  private async executeCourierSnapshot(ctx: TelegramCtx): Promise<void> {
    if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER', 'ORDER_STAFF']))) return
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const [awaitingBooking, liveBooked, deliveredToday] = await Promise.all([
      this.prisma.order.count({
        where: { storeId: ctx.storeId, status: { in: ['CONFIRMED', 'PROCESSING'] }, courier: { is: null } },
      }),
      this.prisma.order.count({
        where: { storeId: ctx.storeId, courier: { is: { status: { in: ['BOOKED', 'IN_TRANSIT'] } } } },
      }),
      this.prisma.order.count({
        where: { storeId: ctx.storeId, status: 'DELIVERED', deliveredAt: { gte: today } },
      }),
    ])
    await this.bot?.sendMessage(
      ctx.chatId,
      `${premiumHeader('Courier Snapshot')}\nAwaiting booking: <b>${awaitingBooking}</b>\nLive booked/in transit: <b>${liveBooked}</b>\nDelivered today: <b>${deliveredToday}</b>\n\n<i>Use /courier SPL-1001 to book by invoice.</i>`,
      { parse_mode: 'HTML', reply_markup: inlineCourierMenu() },
    )
  }

  private async executeInventorySnapshot(ctx: TelegramCtx): Promise<void> {
    if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER', 'ORDER_STAFF']))) return
    const [totalActive, outOfStock, lowStock] = await Promise.all([
      this.prisma.productVariant.count({
        where: { product: { storeId: ctx.storeId, isPublished: true }, isActive: true },
      }),
      this.prisma.productVariant.count({
        where: { product: { storeId: ctx.storeId, isPublished: true }, isActive: true, stock: { lte: 0 } },
      }),
      this.prisma.productVariant.count({
        where: { product: { storeId: ctx.storeId, isPublished: true }, isActive: true, stock: { lte: 5 } },
      }),
    ])
    await this.bot?.sendMessage(
      ctx.chatId,
      `${premiumHeader('Inventory Snapshot')}\nActive variants: <b>${totalActive}</b>\nLow stock (<=5): <b>${lowStock}</b>\nOut of stock: <b>${outOfStock}</b>\n\n<i>Use /stock SKU123 for exact variant lookup.</i>`,
      { parse_mode: 'HTML', reply_markup: inlineInventoryMenu() },
    )
  }

  private async executeInventoryLookupHelp(ctx: TelegramCtx): Promise<void> {
    await this.bot?.sendMessage(
      ctx.chatId,
      `${premiumHeader('SKU Lookup Help')}\nUse <code>/stock SKU123</code> to check one variant.\nUse <code>/check 01700000000</code> for buyer risk.\nUse <code>/order SPL-1001</code> for order drill-down.`,
      { parse_mode: 'HTML', reply_markup: inlineInventoryMenu() },
    )
  }

  private async executeDeliveryDiagnostics(ctx: TelegramCtx): Promise<void> {
    const health = await this.getHealth(ctx.storeId)
    await this.bot?.sendMessage(
      ctx.chatId,
      `${premiumHeader('Delivery Diagnostics')}\nTransport: <b>${health.transportMode}</b>\nWebhook: <b>${health.webhookRegistered ? 'registered' : 'not registered'}</b>\nLast delivery: <b>${health.lastDeliveryStatus}</b>${health.lastDeliveryAt ? `\nAt: ${escapeTelegramHtml(health.lastDeliveryAt)}` : ''}${health.lastDeliveryError ? `\nError: ${escapeTelegramHtml(health.lastDeliveryError)}` : ''}`,
      { parse_mode: 'HTML', reply_markup: deliveryDiagnosticsKeyboard() },
    )
  }

  private async executeLinkedAdmins(ctx: TelegramCtx): Promise<void> {
    const health = await this.getHealth(ctx.storeId)
    const linked = health.linkedAdmins.length
      ? health.linkedAdmins
          .map((admin) => `• ${admin.username ? `@${escapeTelegramHtml(admin.username)}` : admin.telegramIdMasked} · ${escapeTelegramHtml(admin.role)}`)
          .join('\n')
      : '• No linked admins yet'
    await this.bot?.sendMessage(
      ctx.chatId,
      `${premiumHeader('Linked Admins')}\n${linked}\n\nOps chat linked: <b>${health.hasLinkedAdminChat ? 'yes' : 'no'}</b>`,
      { parse_mode: 'HTML', reply_markup: linkedAdminsKeyboard() },
    )
  }

  private async executeCancelOrder(ctx: TelegramCtx, invoiceNumber: string): Promise<void> {
    if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER']))) return

    const order = await this.prisma.order.findFirst({
      where: { storeId: ctx.storeId, invoiceNumber },
      select: { id: true, status: true },
    })
    if (!order) {
      await this.bot?.sendMessage(ctx.chatId, '❌ Order not found')
      return
    }

    try {
      await this.orderStatus.applyStatusChange(
        order.id,
        'CANCELLED',
        'Cancelled via Telegram bot',
        ctx.storeId,
      )
      await this.bot?.sendMessage(ctx.chatId, `❌ Order <b>${invoiceNumber}</b> cancelled`, { parse_mode: 'HTML' })
      await this.logCommand(ctx.chatId, `/cancel ${invoiceNumber}`, ctx.userId)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Cancel failed'
      await this.bot?.sendMessage(ctx.chatId, `❌ ${errMsg}`)
    }
  }

  private async executeInvoice(ctx: TelegramCtx, invoiceNumberRaw?: string): Promise<void> {
    if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER', 'ORDER_STAFF']))) return

    const invoiceNumber = invoiceNumberRaw?.trim().toUpperCase()
    if (!invoiceNumber) {
      await this.bot?.sendMessage(
        ctx.chatId,
        'ℹ️ Please specify invoice number.\nExample: <code>/invoice SPL-1001</code>',
        { parse_mode: 'HTML' },
      )
      return
    }

    const order = await this.prisma.order.findFirst({
      where: { storeId: ctx.storeId, invoiceNumber },
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        status: true,
        shippingName: true,
        shippingPhone: true,
        createdAt: true,
      },
    })

    if (!order) {
      await this.bot?.sendMessage(ctx.chatId, `❌ Order <code>${invoiceNumber}</code> not found.`, {
        parse_mode: 'HTML',
      })
      return
    }

    const siteUrl = resolveCustomerFacingSiteUrl()
    const token = buildInvoiceAccessToken(order.invoiceNumber)
    const webInvoiceUrl = `${siteUrl.replace(/\/+$/, '')}/order-confirmation/${order.id}?token=${encodeURIComponent(token)}`

    const adminBase = resolveCustomerFacingAdminUrl(
      this.config.get<string>('ADMIN_URL') ?? this.config.get<string>('NEXT_PUBLIC_ADMIN_URL'),
    )
    const adminOrderUrl = `${adminBase.replace(/\/+$/, '').replace(/\/login$/i, '')}/dashboard/orders/${encodeURIComponent(order.invoiceNumber)}`

    const msg = `
📄 <b>Invoice · ${escapeTelegramHtml(order.invoiceNumber)}</b>

Customer: ${escapeTelegramHtml(order.shippingName)} (<code>${escapeTelegramHtml(order.shippingPhone)}</code>)
Total: <b>${escapeTelegramHtml(formatBDT(Number(order.total)))}</b>
Status: <b>${escapeTelegramHtml(order.status.replace(/_/g, ' '))}</b>

🔗 <a href="${webInvoiceUrl}">View / Print Customer Invoice</a>
`.trim()

    await this.bot?.sendMessage(ctx.chatId, msg, {
      parse_mode: 'HTML',
      reply_markup: orderActionKeyboard(order.invoiceNumber, {
        adminOrderUrl,
        storefrontUrl: webInvoiceUrl,
        phone: order.shippingPhone,
      }),
    })
    await this.logCommand(ctx.chatId, `/invoice ${invoiceNumber}`, ctx.userId)
  }

  private async executePhoneCheck(ctx: TelegramCtx, phoneRaw?: string): Promise<void> {
    if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER', 'ORDER_STAFF']))) return

    const phone = phoneRaw?.replace(/\s+/g, '')
    if (!phone || phone.length < 6) {
      await this.bot?.sendMessage(
        ctx.chatId,
        'ℹ️ Usage: <code>/check 01700000000</code>\nChecks customer past orders and Steadfast delivery rating.',
        { parse_mode: 'HTML' },
      )
      return
    }

    const cleanPhone = phone.replace(/\D/g, '')
    const digits10 = cleanPhone.slice(-10)

    const [pastOrders, sfRes] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          storeId: ctx.storeId,
          shippingPhone: { contains: digits10 },
        },
        select: {
          invoiceNumber: true,
          status: true,
          total: true,
          shippingName: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.courier?.checkCustomerFraud(ctx.storeId, phone).catch(() => null),
    ])

    const totalOrders = pastOrders.length
    const delivered = pastOrders.filter((o) => o.status === 'DELIVERED').length
    const returnedOrCancelled = pastOrders.filter(
      (o) => o.status === 'RETURNED' || o.status === 'CANCELLED',
    ).length

    let sfText = '⚠️ Steadfast API not connected or no data'
    if (sfRes && sfRes.totalParcels > 0) {
      const icon = sfRes.successRate >= 70 ? '🟢' : sfRes.successRate >= 50 ? '🟡' : '🔴'
      sfText = `${icon} <b>${sfRes.successRate}% Success Rate</b>\n• Total parcels: ${sfRes.totalParcels}\n• Delivered: ${sfRes.delivered}\n• Cancelled/Returned: ${sfRes.cancelled}`
    }

    const orderLines = pastOrders.length
      ? pastOrders.map((o) => `• <code>${o.invoiceNumber}</code> · ${o.status} · ${formatBDT(Number(o.total))}`).join('\n')
      : '• No past orders in this store'

    const wa = formatWhatsAppUrl(phone)
    const replyMarkup = wa
      ? {
          inline_keyboard: [[{ text: '💬 WhatsApp Customer', url: wa }]],
        }
      : undefined

    const msg = `
🔍 <b>Customer Report:</b> <code>${escapeTelegramHtml(phone)}</code>

🚚 <b>Steadfast Network Rating:</b>
${sfText}

📦 <b>Store History (${totalOrders} orders):</b>
• Delivered: <b>${delivered}</b> · Cancelled/Returned: <b>${returnedOrCancelled}</b>
${orderLines}
`.trim()

    await this.bot?.sendMessage(ctx.chatId, msg, {
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    })
    await this.logCommand(ctx.chatId, `/check ${phone}`, ctx.userId)
  }

  private adminLoginUrl(): string {
    const adminBase = resolveCustomerFacingAdminUrl(
      this.config.get<string>('ADMIN_URL') ?? this.config.get<string>('NEXT_PUBLIC_ADMIN_URL'),
    )
    return adminBase.replace(/\/+$/, '').endsWith('/login')
      ? adminBase.replace(/\/+$/, '')
      : `${adminBase.replace(/\/+$/, '')}/login`
  }

  private async executeLinkGroup(ctx: TelegramCtx): Promise<void> {
    if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER']))) return
    if (!ctx.isGroup) {
      await this.bot?.sendMessage(
        ctx.chatId,
        'ℹ️ This command links a <b>group chat</b>. Add the bot to your SPLARO team group, then run /link_group there.',
        { parse_mode: 'HTML' },
      )
      return
    }

    await this.prisma.telegramConfig.update({
      where: { id: ctx.configId },
      data: { chatId: ctx.chatId },
    })

    await this.bot?.sendMessage(
      ctx.chatId,
      `✅ <b>Group Linked!</b>\n\nChat ID: <code>${ctx.chatId}</code>\n\nAll order alerts, courier updates & commands now work in this group.`,
      { parse_mode: 'HTML', reply_markup: inlineAdminMenu() },
    )
    await this.logCommand(ctx.chatId, '/link_group', ctx.userId)
  }

  private async executeGroupInfo(ctx: TelegramCtx): Promise<void> {
    const config = await this.prisma.telegramConfig.findUnique({ where: { id: ctx.configId } })
    const linked = config?.chatId === ctx.chatId
    await this.bot?.sendMessage(
      ctx.chatId,
      `ℹ️ <b>Chat Info</b>\n\nThis chat: <code>${ctx.chatId}</code>\nLinked store chat: <code>${config?.chatId ?? '—'}</code>\nStatus: ${linked ? '✅ Linked' : '⚠️ Not linked'}\n\n${ctx.isGroup ? 'Super admin: send /link_group here to connect.' : 'For groups: add bot → /link_group'}`,
      { parse_mode: 'HTML', reply_markup: inlineAdminMenu() },
    )
  }

  private async executeConfirmOrder(ctx: TelegramCtx, invoiceNumber: string): Promise<void> {
    if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER', 'ORDER_STAFF']))) return
    await this.confirmOrderAndSendInvoice(ctx.storeId, ctx.chatId, invoiceNumber, ctx.userId)
  }

  private async executeBookCourier(ctx: TelegramCtx, invoiceNumber: string): Promise<void> {
    if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER', 'ORDER_STAFF']))) return
    const order = await this.prisma.order.findFirst({
      where: { storeId: ctx.storeId, invoiceNumber },
    })
    if (!order) {
      await this.bot?.sendMessage(ctx.chatId, '❌ Order not found')
      return
    }
    await this.bot?.sendMessage(ctx.chatId, `🚚 Booking courier for <b>${invoiceNumber}</b>…`, { parse_mode: 'HTML' })
    await this.logCommand(ctx.chatId, `/book_courier ${invoiceNumber}`, ctx.userId)
    try {
      const result = await this.courier.bookCourier(order.id)
      if (result.success) {
        const tracking = result.trackingCode ? `\n📦 Tracking: <code>${result.trackingCode}</code>` : ''
        const booked = result.alreadyBooked
          ? `ℹ️ Courier already booked for <b>${invoiceNumber}</b>${tracking}`
          : `✅ Courier booked for <b>${invoiceNumber}</b>${tracking}`
        await this.bot?.sendMessage(ctx.chatId, booked, { parse_mode: 'HTML' })
      } else {
        await this.bot?.sendMessage(ctx.chatId, `❌ Courier failed: ${result.error ?? 'Unknown error'}`, { parse_mode: 'HTML' })
      }
    } catch (err) {
      await this.bot?.sendMessage(ctx.chatId, `❌ ${err instanceof Error ? err.message : 'Booking failed'}`)
    }
  }

  private async resolveContext(msg: Message): Promise<TelegramCtx | null> {
    const chatId = msg.chat.id.toString()
    const userId = msg.from?.id?.toString() ?? chatId
    return this.resolveContextFromIds(chatId, userId, msg.chat.type)
  }

  private async resolveContextFromIds(
    chatId: string,
    userId: string,
    chatType?: Chat['type'],
  ): Promise<TelegramCtx | null> {
    const isGroup = chatType === 'group' || chatType === 'supergroup' || chatId.startsWith('-')

    const byChat = await this.prisma.telegramConfig.findFirst({
      where: { chatId, isActive: true },
    })
    if (byChat) {
      return { chatId, userId, storeId: byChat.storeId, configId: byChat.id, isGroup }
    }

    const teleUser = await this.prisma.telegramUser.findFirst({
      where: { telegramId: userId, isActive: true, config: { isActive: true } },
      include: { config: true },
    })
    if (teleUser) {
      return {
        chatId,
        userId,
        storeId: teleUser.config.storeId,
        configId: teleUser.config.id,
        isGroup,
      }
    }

    const fallback = await this.prisma.telegramConfig.findFirst({ where: { isActive: true } })
    if (!fallback) {
      await this.bot?.sendMessage(chatId, '❌ SPLARO Telegram not configured. Set up in Admin → Telegram Bot.')
      return null
    }

    return { chatId, userId, storeId: fallback.storeId, configId: fallback.id, isGroup }
  }

  async handleWebhookUpdate(body: unknown): Promise<void> {
    if (!this.bot || !body || typeof body !== 'object') return
    this.bot.processUpdate(body as Update)
  }

  private async replyAgentChat(chatId: string, text: string, telegramUserId?: string): Promise<void> {
    if (!telegramUserId) return
    const teleUser = await this.prisma.telegramUser.findFirst({
      where: { telegramId: telegramUserId, isActive: true, config: { isActive: true } },
      include: { config: true },
    })
    if (!teleUser || !['SUPER_ADMIN', 'MANAGER'].includes(teleUser.role)) return

    const storeId = teleUser.config.storeId

    try {
      await this.bot?.sendChatAction(chatId, 'typing')
      const agent = this.moduleRef.get(AgentService, { strict: false })
      const { reply, confirmRequired } = await agent.handleTelegramMessage(
        storeId,
        chatId,
        text,
        telegramUserId,
      )
      const safeReply = sanitizeTelegramAiError(reply)
      const formatted = formatTelegramAiReply(safeReply).slice(0, 3900)
      if (confirmRequired) {
        await this.bot?.sendMessage(chatId, formatted, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Confirm', callback_data: 'agent:confirm' },
                { text: '❌ Cancel', callback_data: 'agent:cancel' },
              ],
            ],
          },
        }).catch(async () => {
          // Fallback to plain text if HTML tags fail to parse
          await this.bot?.sendMessage(chatId, safeReply.slice(0, 3900), {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Confirm', callback_data: 'agent:confirm' },
                  { text: '❌ Cancel', callback_data: 'agent:cancel' },
                ],
              ],
            },
          })
        })
      } else {
        await this.bot?.sendMessage(chatId, formatted, { parse_mode: 'HTML' }).catch(async () => {
          await this.bot?.sendMessage(chatId, safeReply.slice(0, 3900))
        })
      }
      await this.logCommand(chatId, `AI: ${text.slice(0, 180)}`, telegramUserId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI agent failed'
      this.logger.error(`Telegram AI reply failed: ${msg}`)
      await this.bot?.sendMessage(chatId, sanitizeTelegramAiError(msg) || TELEGRAM_AI_UNAVAILABLE)
    }
  }

  private async getProfitSummary(storeId: string, period: 'today' | 'month'): Promise<string> {
    const now = new Date()
    const start = period === 'today'
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth(), 1)

    const calcs = await this.prisma.profitCalculation.findMany({
      where: { storeId, calculatedAt: { gte: start } },
    })

    const netProfit = calcs.reduce((s, c) => s + Number(c.netProfit), 0)
    const revenue = calcs.reduce((s, c) => s + Number(c.grossRevenue), 0)

    return `
📊 <b>Profit ${period === 'today' ? 'Today' : 'This Month'}</b>
💰 Revenue: <b>${formatBDT(revenue)}</b>
✅ Net Profit: <b>${formatBDT(netProfit)}</b>
📦 Orders: ${calcs.length}
`.trim()
  }

  async notifyPartnerTransaction(
    storeId: string,
    tx: { partnerName: string; type: string; amount: number; status: string },
  ): Promise<void> {
    const msg = `
💼 <b>Partner Transaction</b>
Partner: ${tx.partnerName}
Type: ${tx.type.replace(/_/g, ' ')}
Amount: <b>${formatBDT(tx.amount)}</b>
Status: ${tx.status}
`.trim()
    await this.sendToStore(storeId, msg)
  }

  async notifySheetsSyncFailed(storeId: string, sheetType: string, error: string): Promise<void> {
    await this.sendToStore(storeId, `❌ <b>Google Sheets Sync Failed</b>\nSheet: ${sheetType}\nError: ${error}`)
  }

  async notifyAIProductGenerated(storeId: string, productName: string): Promise<void> {
    await this.sendToStore(storeId, `🤖 <b>AI Product Generated</b>\n${productName}\nReview in admin → AI Product Agent`)
  }

  private async checkUserPermission(
    telegramUserId: string,
    allowedRoles: TelegramRole[],
    configId?: string,
  ): Promise<boolean> {
    if (!telegramUserId) return false
    const user = await this.prisma.telegramUser.findFirst({
      where: {
        telegramId: telegramUserId,
        isActive: true,
        ...(configId ? { configId } : {}),
        config: { isActive: true },
      },
    })
    return user !== null && allowedRoles.includes(user.role)
  }

  private async logCommand(chatId: string, command: string, userId?: string): Promise<void> {
    const config = await this.prisma.telegramConfig.findFirst({ where: { chatId } })
    if (!config) return
    await this.prisma.telegramLog.create({
      data: { configId: config.id, type: 'COMMAND', command, userId, message: command, success: true },
    })
  }
}
