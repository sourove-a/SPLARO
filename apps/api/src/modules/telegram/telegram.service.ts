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
import { AgentService } from '../agent'
import { AuthService } from '../auth/auth.service'
import { AdminLoginTokenService } from '../auth/admin-login-token.service'
import { TelegramIntegrationService } from '../integrations/telegram-integration.service'
import { OrderEventsService } from '../orders/order-events.service'
import { assertOrderStatusTransition, STOCK_RESTORING_STATUSES } from '../../common/order-status.util'
import { restoreOrderStock } from '../../common/order-stock.util'
import TelegramBot from 'node-telegram-bot-api'
import { mapStaffRoleToTelegram, maskTelegramId } from './telegram.util'
import type { TelegramDeliveryDiagnostics, TelegramHealthSnapshot } from './telegram.types'
import { formatBDT } from '../../common/utils/currency'
import { SPLARO_DOMAINS } from '@splaro/config'
import type { TelegramRole } from '@prisma/client'
import {
  BOT_COMMANDS,
  BUTTON_ROUTES,
  TG_CALLBACK,
  inlineFinanceMenu,
  inlineMainMenu,
  inlineOrdersMenu,
  loginCopyKeyboard,
  mainReplyKeyboard,
  menuMessage,
  orderActionKeyboard,
  parseOrderCallback,
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

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InvoiceService) private readonly invoices: InvoiceService,
    @Inject(forwardRef(() => CourierService))
    private readonly courier: CourierService,
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
    this.bot = new TelegramBot(token, { polling: usePolling })
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

  private async resolveBotToken(): Promise<string | null> {
    const envToken = this.config.get<string>('TELEGRAM_BOT_TOKEN')?.trim()
    if (envToken) {
      this.botTokenSource = 'env'
      return envToken
    }

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

    this.botTokenSource = 'none'
    return null
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
    replyMarkup?: TelegramBot.InlineKeyboardMarkup,
  ): Promise<void> {
    await this.sendToStoreWithResult(storeId, message, replyMarkup)
  }

  /** Returns whether the message was delivered to the store Telegram chat. */
  async sendToStoreWithResult(
    storeId: string,
    message: string,
    replyMarkup?: TelegramBot.InlineKeyboardMarkup,
  ): Promise<boolean> {
    const config = await this.prisma.telegramConfig.findUnique({ where: { storeId } })
    if (!config?.isActive || !this.bot) return false

    try {
      await this.bot.sendMessage(config.chatId, message, {
        parse_mode: 'HTML',
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

    let nextStatus: typeof order.status
    try {
      nextStatus = assertOrderStatusTransition(order.status, 'CONFIRMED')
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

    const statusChanged = order.status !== nextStatus
    if (statusChanged) {
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { status: nextStatus, confirmedAt: new Date() },
        })
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: nextStatus,
            note: telegramUserId ? 'Confirmed via Telegram bot' : 'Confirmed via Telegram',
          },
        })
      })

      const orderEvents = this.moduleRef.get(OrderEventsService, { strict: false })
      void orderEvents?.onStatusChanged(
        storeId,
        order.id,
        nextStatus,
        'Confirmed via Telegram',
      )

      await this.bot?.sendMessage(targetChat, `✅ Order <b>${invoiceNumber}</b> confirmed`, {
        parse_mode: 'HTML',
      })
      if (telegramUserId) {
        await this.logCommand(targetChat, `/confirm_order ${invoiceNumber}`, telegramUserId)
      }
    } else {
      await this.bot?.sendMessage(
        targetChat,
        `ℹ️ Order <b>${invoiceNumber}</b> is already confirmed — resending invoice`,
        { parse_mode: 'HTML' },
      )
    }

    const invoice = await this.sendInvoiceToChat(storeId, targetChat, invoiceNumber)
    if (!invoice.sent) {
      await this.bot?.sendMessage(
        targetChat,
        `⚠️ Order confirmed but invoice could not be sent. Try /order ${invoiceNumber}`,
      )
    }

    return {
      confirmed: statusChanged || order.status === 'CONFIRMED',
      invoiceSent: invoice.sent,
      ...(invoice.format ? { format: invoice.format } : {}),
    }
  }

  async notifyNewOrder(storeId: string, order: {
    invoiceNumber: string
    total: number
    paymentMethod: string
    shippingName: string
    shippingPhone: string
    shippingCity: string
    itemCount: number
    isCodRisk: boolean
  }): Promise<void> {
    const dedupeKey = `new-order:${storeId}:${order.invoiceNumber}`
    if (!this.shouldSendNotification(dedupeKey)) return

    const config = await this.prisma.telegramConfig.findUnique({ where: { storeId } })
    if (!config?.notifyOrders) return

    const riskWarning = order.isCodRisk ? '\n⚠️ <b>COD RISK DETECTED</b>' : ''
    const msg = `
🛍 <b>New Order Received</b>

Order: <code>${order.invoiceNumber}</code>
Customer: ${order.shippingName}
Phone: <code>${order.shippingPhone}</code>
City: ${order.shippingCity}
Payment: ${order.paymentMethod.replace(/_/g, ' ')}
Total: <b>${formatBDT(order.total)}</b>
Delivery: ${order.shippingCity.includes('Dhaka') ? 'Inside Dhaka' : 'Outside Dhaka'}
Status: Pending
Items: ${order.itemCount}${riskWarning}

<i>Tap buttons below or send <code>${order.invoiceNumber}</code> to track.</i>
`.trim()

    await this.sendToStore(storeId, msg, orderActionKeyboard(order.invoiceNumber))
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

Order: <code>${input.invoiceNumber}</code>
Gateway: ${input.gateway ?? 'Online payment'}

<i>Track: send only <code>${input.invoiceNumber}</code> to this bot.</i>
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

  async replyOrderTrack(chatId: string, invoiceNumber: string): Promise<void> {
    const order = await this.prisma.order.findFirst({
      where: { invoiceNumber },
      include: { items: { take: 4 }, courier: true },
    })

    if (!order) {
      await this.bot?.sendMessage(chatId, `❌ Order <code>${invoiceNumber}</code> not found.`, {
        parse_mode: 'HTML',
      })
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

    await this.bot?.sendMessage(chatId, msg, { parse_mode: 'HTML' })
  }

  async notifyLowStock(storeId: string, items: { name: string; sku: string; stock: number }[]): Promise<void> {
    const config = await this.prisma.telegramConfig.findUnique({ where: { storeId } })
    if (!config?.notifyStock) return

    const list = items.map((i) => `• ${i.name} (${i.sku}): <b>${i.stock} left</b>`).join('\n')
    const msg = `⚠️ <b>LOW STOCK ALERT</b>\n\n${list}`
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
🚚 <b>COURIER BOOKING FAILED</b>

📋 Invoice: <code>${order.invoiceNumber}</code>
🏢 Provider: ${order.provider}
❌ Error: ${order.error}

<i>Order added to retry queue. Check admin for manual retry.</i>
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
🚚 <b>Courier Booked</b>

📋 Invoice: <code>${order.invoiceNumber}</code>
🏢 Provider: ${order.provider}${tracking}
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
📊 <b>DAILY REPORT — ${today.toLocaleDateString('en-BD')}</b>

📦 Orders: <b>${orders}</b>
💰 Revenue: <b>${formatBDT(Number(revenue._sum.total ?? 0))}</b>

<i>Check admin panel for full analytics.</i>
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
      await this.replyOrderTrack(ctx.chatId, invoice)
      await this.logCommand(ctx.chatId, `/order ${invoice}`, ctx.userId)
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
          await this.replyOrderTrack(ctx.chatId, orderAction.invoice)
        } else if (orderAction.action === 'confirm') {
          await this.executeConfirmOrder(ctx, orderAction.invoice)
        } else {
          await this.executeBookCourier(ctx, orderAction.invoice)
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

      const routeKey = BUTTON_ROUTES[text]
      if (routeKey) {
        if (routeKey === TG_CALLBACK.MENU_MAIN) {
          await this.sendWelcome(ctx, msg.from?.first_name)
        } else {
          await this.executeAction(routeKey, ctx, msg, msg.from?.first_name)
        }
        return
      }

      const invoiceNumber = text.toUpperCase()
      if (/^SPL-\d+/.test(invoiceNumber)) {
        await this.replyOrderTrack(ctx.chatId, invoiceNumber)
        return
      }

      await this.replyAgentChat(ctx.chatId, text, ctx.userId)
    })

    this.logger.log('Telegram commands registered')
  }

  private async sendWelcome(ctx: TelegramCtx, firstName?: string): Promise<void> {
    const config = await this.prisma.telegramConfig.findUnique({ where: { id: ctx.configId } })
    const linked = config?.chatId === ctx.chatId
    await this.bot?.sendMessage(ctx.chatId, welcomeMessage({
      name: firstName,
      isGroup: ctx.isGroup,
      storeLinked: linked,
    }), {
      parse_mode: 'HTML',
      reply_markup: inlineMainMenu(),
    })
    await this.bot?.sendMessage(ctx.chatId, '⌨️ <b>Keyboard shortcuts</b> — use buttons below anytime.', {
      parse_mode: 'HTML',
      reply_markup: mainReplyKeyboard(),
    })
  }

  private async executeAction(
    action: string,
    ctx: TelegramCtx,
    msg: TelegramBot.Message,
    firstName?: string,
  ): Promise<void> {
    switch (action) {
      case TG_CALLBACK.MENU_MAIN:
        await this.sendWelcome(ctx, firstName ?? msg.from?.first_name)
        break
      case TG_CALLBACK.MENU_ORDERS:
        await this.bot?.sendMessage(ctx.chatId, '📦 <b>Orders Hub</b>\nChoose an action:', {
          parse_mode: 'HTML',
          reply_markup: inlineOrdersMenu(),
        })
        break
      case TG_CALLBACK.MENU_FINANCE:
        if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER', 'FINANCE_STAFF', 'PARTNER']))) return
        await this.bot?.sendMessage(ctx.chatId, '💹 <b>Finance Hub</b>\nChoose an action:', {
          parse_mode: 'HTML',
          reply_markup: inlineFinanceMenu(),
        })
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
    await this.bot?.sendMessage(ctx.chatId, `📦 <b>Today's Orders</b>\n\nCount: <b>${count}</b>`, { parse_mode: 'HTML' })
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
      `💰 <b>Today's Sales</b>\n\nOrders: <b>${agg._count}</b>\nRevenue: <b>${formatBDT(Number(agg._sum.total ?? 0))}</b>`,
      { parse_mode: 'HTML' },
    )
    await this.logCommand(ctx.chatId, '/today_sales', ctx.userId)
  }

  private async executePendingOrders(ctx: TelegramCtx): Promise<void> {
    const count = await this.prisma.order.count({ where: { storeId: ctx.storeId, status: 'PENDING' } })
    await this.bot?.sendMessage(ctx.chatId, `⏳ <b>Pending Orders</b>\n\nCount: <b>${count}</b>`, { parse_mode: 'HTML' })
  }

  private async executeLowStock(ctx: TelegramCtx): Promise<void> {
    const variants = await this.prisma.productVariant.findMany({
      where: { product: { storeId: ctx.storeId, isPublished: true }, stock: { lte: 5 }, isActive: true },
      include: { product: { select: { name: true } } },
      take: 10,
      orderBy: { stock: 'asc' },
    })
    if (variants.length === 0) {
      await this.bot?.sendMessage(ctx.chatId, '✅ No low stock items found')
      return
    }
    const list = variants
      .map((v) => `• ${v.product.name} (${[v.size, v.color].filter(Boolean).join(' ').trim()}): <b>${v.stock}</b>`)
      .join('\n')
    await this.bot?.sendMessage(ctx.chatId, `⚠️ <b>Low Stock (${variants.length})</b>\n\n${list}`, { parse_mode: 'HTML' })
  }

  private async executeDeliveredToday(ctx: TelegramCtx): Promise<void> {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const count = await this.prisma.order.count({
      where: { storeId: ctx.storeId, status: 'DELIVERED', deliveredAt: { gte: today } },
    })
    await this.bot?.sendMessage(ctx.chatId, `✅ <b>Delivered Today</b>\n\nCount: <b>${count}</b>`, { parse_mode: 'HTML' })
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
      `💸 <b>Expenses Today</b>\n\nTotal: <b>${formatBDT(Number(agg._sum.amount ?? 0))}</b>\nEntries: ${agg._count}`,
      { parse_mode: 'HTML' },
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
      { parse_mode: 'HTML', reply_markup: inlineMainMenu() },
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
        await this.bot?.sendMessage(
          ctx.chatId,
          `❌ Could not deliver login token.\n\nToken: <code>${code}</code>\n\nCopy and paste at ${this.adminLoginUrl()}`,
          { parse_mode: 'HTML', reply_markup: loginCopyKeyboard(code) },
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

    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, isActive: true },
      select: { telegramId: true },
    })

    if (user?.telegramId?.trim()) {
      return { ok: true, chatIds: [user.telegramId.trim()] }
    }

    if (envTelegramId && envAdminEmail === normalizedEmail) {
      return { ok: true, chatIds: [envTelegramId] }
    }

    if (envAdminEmail === normalizedEmail) {
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
      const message = `🔐 <b>Admin Panel Login</b>\n\nEmail: <code>${email}</code>\nToken: <code>${code}</code>\n\n⏱ Valid <b>5 min</b> · one-time\n📋 Tap <b>Copy Token</b> → paste in admin\n\n<i>${adminUrl}</i>`

      for (const chatId of chatIds) {
        await this.bot.sendMessage(chatId, message, {
          parse_mode: 'HTML',
          reply_markup: loginCopyKeyboard(code),
        })
      }
      this.recordDeliverySuccess()
      return true
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'sendMessage failed'
      this.recordDeliveryFailure(errMsg)
      this.logger.error(`Admin login token delivery failed: ${errMsg}`)
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
      `${apiEmoji} <b>SPLARO Status</b>\n\nAPI: <b>${apiStatus}</b>${latestHealth?.responseMs ? ` (${latestHealth.responseMs}ms)` : ''}\nBot: ${botOk ? '🟢 Running' : '🔴 Disabled'}\n\n📦 Today: <b>${todayOrders}</b> orders · ${formatBDT(Number(todayRevenue._sum.total ?? 0))}\n⏳ Pending: <b>${pending}</b>`,
      { parse_mode: 'HTML', reply_markup: inlineMainMenu() },
    )
    await this.logCommand(ctx.chatId, '/status', ctx.userId)
  }

  private async executeOrdersList(ctx: TelegramCtx): Promise<void> {
    if (!(await this.requireRoles(ctx, ['SUPER_ADMIN', 'MANAGER', 'ORDER_STAFF']))) return

    const orders = await this.prisma.order.findMany({
      where: { storeId: ctx.storeId },
      orderBy: { createdAt: 'desc' },
      take: 10,
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

    const lines = orders
      .map(
        (o) =>
          `• <code>${o.invoiceNumber}</code> · ${o.status.replace(/_/g, ' ')} · ${formatBDT(Number(o.total))}\n  ${o.shippingName}`,
      )
      .join('\n')

    await this.bot?.sendMessage(
      ctx.chatId,
      `📦 <b>Latest orders</b>\n\n${lines}\n\n<i>/order SPL-1001 for details</i>`,
      { parse_mode: 'HTML' },
    )
    await this.logCommand(ctx.chatId, '/orders', ctx.userId)
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
      const status = assertOrderStatusTransition(order.status, 'CANCELLED')
      const shouldRestoreStock =
        STOCK_RESTORING_STATUSES.includes(status) &&
        !STOCK_RESTORING_STATUSES.includes(order.status)

      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { status, cancelledAt: new Date() },
        })
        if (shouldRestoreStock) {
          await restoreOrderStock(tx, order.id, `Stock restored — order cancelled via Telegram`)
        }
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status,
            note: 'Cancelled via Telegram bot',
          },
        })
      })

      const orderEvents = this.moduleRef.get(OrderEventsService, { strict: false })
      void orderEvents.onStatusChanged(ctx.storeId, order.id, 'CANCELLED', 'Cancelled via Telegram bot')

      await this.bot?.sendMessage(ctx.chatId, `❌ Order <b>${invoiceNumber}</b> cancelled`, { parse_mode: 'HTML' })
      await this.logCommand(ctx.chatId, `/cancel ${invoiceNumber}`, ctx.userId)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Cancel failed'
      await this.bot?.sendMessage(ctx.chatId, `❌ ${errMsg}`)
    }
  }

  private adminLoginUrl(): string {
    const adminBase =
      this.config.get<string>('ADMIN_URL')?.trim() ||
      this.config.get<string>('NEXT_PUBLIC_ADMIN_URL')?.trim() ||
      process.env['ADMIN_URL']?.trim() ||
      process.env['NEXT_PUBLIC_ADMIN_URL']?.trim() ||
      SPLARO_DOMAINS.admin
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
      { parse_mode: 'HTML', reply_markup: inlineMainMenu() },
    )
    await this.logCommand(ctx.chatId, '/link_group', ctx.userId)
  }

  private async executeGroupInfo(ctx: TelegramCtx): Promise<void> {
    const config = await this.prisma.telegramConfig.findUnique({ where: { id: ctx.configId } })
    const linked = config?.chatId === ctx.chatId
    await this.bot?.sendMessage(
      ctx.chatId,
      `ℹ️ <b>Chat Info</b>\n\nThis chat: <code>${ctx.chatId}</code>\nLinked store chat: <code>${config?.chatId ?? '—'}</code>\nStatus: ${linked ? '✅ Linked' : '⚠️ Not linked'}\n\n${ctx.isGroup ? 'Super admin: send /link_group here to connect.' : 'For groups: add bot → /link_group'}`,
      { parse_mode: 'HTML', reply_markup: inlineMainMenu() },
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
        await this.bot?.sendMessage(ctx.chatId, `✅ Courier booked for <b>${invoiceNumber}</b>${tracking}`, { parse_mode: 'HTML' })
      } else {
        await this.bot?.sendMessage(ctx.chatId, `❌ Courier failed: ${result.error ?? 'Unknown error'}`, { parse_mode: 'HTML' })
      }
    } catch (err) {
      await this.bot?.sendMessage(ctx.chatId, `❌ ${err instanceof Error ? err.message : 'Booking failed'}`)
    }
  }

  private async resolveContext(msg: TelegramBot.Message): Promise<TelegramCtx | null> {
    const chatId = msg.chat.id.toString()
    const userId = msg.from?.id?.toString() ?? chatId
    return this.resolveContextFromIds(chatId, userId, msg.chat.type)
  }

  private async resolveContextFromIds(
    chatId: string,
    userId: string,
    chatType?: TelegramBot.Chat['type'],
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
    this.bot.processUpdate(body as TelegramBot.Update)
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
      const { reply, confirmRequired } = await agent.handleTelegramMessage(storeId, chatId, text)
      if (confirmRequired) {
        await this.bot?.sendMessage(chatId, reply.slice(0, 3900), {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Confirm', callback_data: 'agent:confirm' },
                { text: '❌ Cancel', callback_data: 'agent:cancel' },
              ],
            ],
          },
        })
      } else {
        await this.bot?.sendMessage(chatId, reply.slice(0, 3900), { parse_mode: 'HTML' })
      }
      await this.logCommand(chatId, `AI: ${text.slice(0, 180)}`, telegramUserId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI agent failed'
      this.logger.error(`Telegram AI reply failed: ${msg}`)
      await this.bot?.sendMessage(chatId, `AI error: ${msg}`)
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
