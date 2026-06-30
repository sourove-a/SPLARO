import { Inject, Injectable, Logger, OnModuleInit, forwardRef } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ModuleRef } from '@nestjs/core'
import { PrismaService } from '../../common/prisma.service'
import { InvoiceService } from '../invoices/invoice.service'
import { CourierService } from '../courier/courier.service'
import { AgentService } from '../agent'
import TelegramBot from 'node-telegram-bot-api'
import { formatBDT } from '../../common/utils/currency'
import type { TelegramRole } from '@prisma/client'

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name)
  private bot: TelegramBot | null = null

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InvoiceService) private readonly invoices: InvoiceService,
    @Inject(forwardRef(() => CourierService))
    private readonly courier: CourierService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN')
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — bot disabled')
      return
    }

    this.bot = new TelegramBot(token, { polling: true })
    this.registerCommands()
    this.logger.log('Telegram bot initialized')
  }

  // ── SEND METHODS ──────────────────────────────────────────

  async sendToStore(storeId: string, message: string): Promise<void> {
    const config = await this.prisma.telegramConfig.findUnique({ where: { storeId } })
    if (!config?.isActive || !this.bot) return

    try {
      await this.bot.sendMessage(config.chatId, message, { parse_mode: 'HTML' })
      await this.prisma.telegramLog.create({
        data: { configId: config.id, type: 'NOTIFICATION', message, success: true },
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      this.logger.error(`Telegram send failed: ${errMsg}`)
      await this.prisma.telegramLog.create({
        data: { configId: config.id, type: 'ERROR', message: errMsg, success: false },
      })
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
      select: { id: true },
    })
    if (!order) {
      await this.bot?.sendMessage(targetChat, '❌ Order not found')
      return { confirmed: false, invoiceSent: false }
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'CONFIRMED' },
    })
    await this.bot?.sendMessage(targetChat, `✅ Order <b>${invoiceNumber}</b> confirmed`, { parse_mode: 'HTML' })
    if (telegramUserId) {
      await this.logCommand(targetChat, `/confirm_order ${invoiceNumber}`, telegramUserId)
    }

    const invoice = await this.sendInvoiceToChat(storeId, targetChat, invoiceNumber)
    if (!invoice.sent) {
      await this.bot?.sendMessage(
        targetChat,
        `⚠️ Order confirmed but invoice could not be sent. Try /order ${invoiceNumber}`,
      )
    }

    return { confirmed: true, invoiceSent: invoice.sent, ...(invoice.format ? { format: invoice.format } : {}) }
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

<i>Actions: /confirm_order ${order.invoiceNumber} · /book_courier ${order.invoiceNumber} · /order ${order.invoiceNumber}</i>
`.trim()

    await this.sendToStore(storeId, msg)
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

    this.bot.onText(/\/today_orders/, async (msg) => {
      const chatId = msg.chat.id.toString()
      const authorized = await this.checkPermission(chatId, ['SUPER_ADMIN', 'MANAGER', 'ORDER_STAFF'])
      if (!authorized) {
        await this.bot?.sendMessage(chatId, '❌ Unauthorized')
        return
      }

      const storeId = await this.getStoreIdByChatId(chatId)
      if (!storeId) { await this.bot?.sendMessage(chatId, '❌ Store not configured'); return }

      const today = new Date(); today.setHours(0, 0, 0, 0)
      const count = await this.prisma.order.count({ where: { storeId, createdAt: { gte: today } } })
      await this.bot?.sendMessage(chatId, `📦 Today's orders: <b>${count}</b>`, { parse_mode: 'HTML' })

      await this.logCommand(chatId, '/today_orders')
    })

    this.bot.onText(/\/today_sales/, async (msg) => {
      const chatId = msg.chat.id.toString()
      const authorized = await this.checkPermission(chatId, ['SUPER_ADMIN', 'MANAGER'])
      if (!authorized) { await this.bot?.sendMessage(chatId, '❌ Unauthorized'); return }

      const storeId = await this.getStoreIdByChatId(chatId)
      if (!storeId) return

      const today = new Date(); today.setHours(0, 0, 0, 0)
      const agg = await this.prisma.order.aggregate({
        where: { storeId, createdAt: { gte: today }, status: { not: 'CANCELLED' } },
        _sum: { total: true },
        _count: true,
      })

      await this.bot?.sendMessage(
        chatId,
        `💰 Today's sales:\nOrders: <b>${agg._count}</b>\nRevenue: <b>${formatBDT(Number(agg._sum.total ?? 0))}</b>`,
        { parse_mode: 'HTML' }
      )
      await this.logCommand(chatId, '/today_sales')
    })

    this.bot.onText(/\/pending_orders/, async (msg) => {
      const chatId = msg.chat.id.toString()
      const storeId = await this.getStoreIdByChatId(chatId)
      if (!storeId) return

      const count = await this.prisma.order.count({ where: { storeId, status: 'PENDING' } })
      await this.bot?.sendMessage(chatId, `⏳ Pending orders: <b>${count}</b>`, { parse_mode: 'HTML' })
    })

    this.bot.onText(/\/low_stock/, async (msg) => {
      const chatId = msg.chat.id.toString()
      const storeId = await this.getStoreIdByChatId(chatId)
      if (!storeId) return

      const variants = await this.prisma.productVariant.findMany({
        where: { product: { storeId, isPublished: true }, stock: { lte: 5 }, isActive: true },
        include: { product: { select: { name: true } } },
        take: 10,
        orderBy: { stock: 'asc' },
      })

      if (variants.length === 0) {
        await this.bot?.sendMessage(chatId, '✅ No low stock items found')
        return
      }

      const list = variants.map(v => `• ${v.product.name} (${v.size ?? ''} ${v.color ?? ''}).trim(): ${v.stock} left`).join('\n')
      await this.bot?.sendMessage(chatId, `⚠️ <b>Low Stock (${variants.length} items)</b>\n\n${list}`, { parse_mode: 'HTML' })
    })

    this.bot.onText(/\/order (.+)/, async (msg, match) => {
      const chatId = msg.chat.id.toString()
      const invoiceNumber = match?.[1]?.trim()
      if (!invoiceNumber) return
      await this.replyOrderTrack(chatId, invoiceNumber)
    })

    this.bot.on('message', async (msg) => {
      if (!msg.text || msg.text.startsWith('/')) return
      const chatId = msg.chat.id.toString()
      const text = msg.text.trim()
      if (!text) return

      const invoiceNumber = text.toUpperCase()
      if (/^SPL-\d+/.test(invoiceNumber)) {
        await this.replyOrderTrack(chatId, invoiceNumber)
        return
      }

      await this.replyAgentChat(chatId, text, msg.from?.id.toString())
    })

    this.bot.onText(/\/book_courier (.+)/, async (msg, match) => {
      const chatId = msg.chat.id.toString()
      const authorized = await this.checkPermission(chatId, ['SUPER_ADMIN', 'MANAGER', 'ORDER_STAFF'])
      if (!authorized) { await this.bot?.sendMessage(chatId, '❌ Unauthorized'); return }

      const invoiceNumber = match?.[1]?.trim()
      const storeId = await this.getStoreIdByChatId(chatId)
      const order = await this.prisma.order.findFirst({
        where: storeId ? { storeId, invoiceNumber: invoiceNumber ?? '' } : { invoiceNumber: invoiceNumber ?? '' },
      })
      if (!order) { await this.bot?.sendMessage(chatId, '❌ Order not found'); return }

      await this.bot?.sendMessage(chatId, `🚚 Booking courier for <b>${invoiceNumber}</b>...`, { parse_mode: 'HTML' })
      await this.logCommand(chatId, `/book_courier ${invoiceNumber}`, msg.from?.id.toString())

      try {
        const result = await this.courier.bookCourier(order.id)
        if (result.success) {
          const tracking = result.trackingCode ? `\n📦 Tracking: <code>${result.trackingCode}</code>` : ''
          await this.bot?.sendMessage(
            chatId,
            `✅ Courier booked for <b>${invoiceNumber}</b>${tracking}`,
            { parse_mode: 'HTML' },
          )
        } else {
          await this.bot?.sendMessage(
            chatId,
            `❌ Courier booking failed for <b>${invoiceNumber}</b>\n${result.error ?? 'Unknown error'}`,
            { parse_mode: 'HTML' },
          )
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Booking failed'
        await this.bot?.sendMessage(chatId, `❌ Courier booking error: ${errMsg}`)
      }
    })

    this.bot.onText(/\/confirm_order (.+)/, async (msg, match) => {
      const chatId = msg.chat.id.toString()
      const authorized = await this.checkPermission(chatId, ['SUPER_ADMIN', 'MANAGER', 'ORDER_STAFF'])
      if (!authorized) { await this.bot?.sendMessage(chatId, '❌ Unauthorized'); return }

      const invoiceNumber = match?.[1]?.trim()
      if (!invoiceNumber) {
        await this.bot?.sendMessage(chatId, '❌ Invoice number required')
        return
      }

      const storeId = await this.getStoreIdByChatId(chatId)
      if (!storeId) return

      await this.confirmOrderAndSendInvoice(
        storeId,
        chatId,
        invoiceNumber,
        msg.from?.id.toString(),
      )
    })

    this.bot.onText(/\/report_today/, async (msg) => {
      const chatId = msg.chat.id.toString()
      const storeId = await this.getStoreIdByChatId(chatId)
      if (!storeId) return
      await this.sendDailyReport(storeId)
    })

    this.bot.onText(/\/delivered_today/, async (msg) => {
      const chatId = msg.chat.id.toString()
      const storeId = await this.getStoreIdByChatId(chatId)
      if (!storeId) return
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const count = await this.prisma.order.count({
        where: { storeId, status: 'DELIVERED', deliveredAt: { gte: today } },
      })
      await this.bot?.sendMessage(chatId, `✅ Delivered today: <b>${count}</b>`, { parse_mode: 'HTML' })
    })

    this.bot.onText(/\/profit_today/, async (msg) => {
      const chatId = msg.chat.id.toString()
      if (!(await this.checkPermission(chatId, ['SUPER_ADMIN', 'MANAGER', 'FINANCE_STAFF', 'PARTNER']))) {
        await this.bot?.sendMessage(chatId, '❌ Unauthorized'); return
      }
      const storeId = await this.getStoreIdByChatId(chatId)
      if (!storeId) return
      const summary = await this.getProfitSummary(storeId, 'today')
      await this.bot?.sendMessage(chatId, summary, { parse_mode: 'HTML' })
    })

    this.bot.onText(/\/profit_month/, async (msg) => {
      const chatId = msg.chat.id.toString()
      if (!(await this.checkPermission(chatId, ['SUPER_ADMIN', 'MANAGER', 'FINANCE_STAFF', 'PARTNER']))) {
        await this.bot?.sendMessage(chatId, '❌ Unauthorized'); return
      }
      const storeId = await this.getStoreIdByChatId(chatId)
      if (!storeId) return
      const summary = await this.getProfitSummary(storeId, 'month')
      await this.bot?.sendMessage(chatId, summary, { parse_mode: 'HTML' })
    })

    for (const slug of ['sourove', 'raju', 'hridoy'] as const) {
      this.bot.onText(new RegExp(`/partner_${slug}`), async (msg) => {
        const chatId = msg.chat.id.toString()
        if (!(await this.checkPermission(chatId, ['SUPER_ADMIN', 'MANAGER', 'FINANCE_STAFF', 'PARTNER']))) {
          await this.bot?.sendMessage(chatId, '❌ Unauthorized'); return
        }
        const storeId = await this.getStoreIdByChatId(chatId)
        if (!storeId) return
        const partner = await this.prisma.partner.findFirst({ where: { storeId, slug } })
        if (!partner) { await this.bot?.sendMessage(chatId, '❌ Partner not found'); return }
        const msgText = `
👤 <b>Partner: ${partner.name}</b>
💰 Balance: <b>${formatBDT(Number(partner.currentBalance))}</b>
📈 Investment: ${formatBDT(Number(partner.totalInvestment))}
📤 Withdrawals: ${formatBDT(Number(partner.totalWithdrawal))}
📊 Profit Share: ${formatBDT(Number(partner.totalProfitShare))}
📐 Share: ${Number(partner.sharePercent)}%
`.trim()
        await this.bot?.sendMessage(chatId, msgText, { parse_mode: 'HTML' })
      })
    }

    this.bot.onText(/\/expenses_today/, async (msg) => {
      const chatId = msg.chat.id.toString()
      if (!(await this.checkPermission(chatId, ['SUPER_ADMIN', 'MANAGER', 'FINANCE_STAFF']))) {
        await this.bot?.sendMessage(chatId, '❌ Unauthorized'); return
      }
      const storeId = await this.getStoreIdByChatId(chatId)
      if (!storeId) return
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const agg = await this.prisma.expense.aggregate({
        where: { storeId, expenseDate: { gte: today }, status: 'APPROVED' },
        _sum: { amount: true },
        _count: true,
      })
      await this.bot?.sendMessage(
        chatId,
        `💸 Expenses today: <b>${formatBDT(Number(agg._sum.amount ?? 0))}</b> (${agg._count} entries)`,
        { parse_mode: 'HTML' },
      )
    })

    this.bot.onText(/\/customer (.+)/, async (msg, match) => {
      const chatId = msg.chat.id.toString()
      const phone = match?.[1]?.trim()
      if (!phone) return
      const storeId = await this.getStoreIdByChatId(chatId)
      if (!storeId) return
      const customer = await this.prisma.customer.findFirst({
        where: { storeId, phone: { contains: phone } },
      })
      if (!customer) { await this.bot?.sendMessage(chatId, '❌ Customer not found'); return }
      await this.bot?.sendMessage(
        chatId,
        `👤 ${customer.firstName} ${customer.lastName}\n📞 ${customer.phone}\n📦 Orders: ${customer.totalOrders}`,
        { parse_mode: 'HTML' },
      )
    })

    this.bot.onText(/\/stock (.+)/, async (msg, match) => {
      const chatId = msg.chat.id.toString()
      const sku = match?.[1]?.trim()?.toUpperCase()
      if (!sku) return
      const variant = await this.prisma.productVariant.findFirst({
        where: { sku: { equals: sku, mode: 'insensitive' } },
        include: { product: { select: { name: true } } },
      })
      if (!variant) { await this.bot?.sendMessage(chatId, `❌ SKU ${sku} not found`); return }
      await this.bot?.sendMessage(
        chatId,
        `📦 ${variant.product.name}\nSKU: ${variant.sku}\nStock: <b>${variant.stock}</b>`,
        { parse_mode: 'HTML' },
      )
    })

    this.bot.onText(/\/sync_sheets/, async (msg) => {
      const chatId = msg.chat.id.toString()
      if (!(await this.checkPermission(chatId, ['SUPER_ADMIN', 'MANAGER', 'FINANCE_STAFF']))) {
        await this.bot?.sendMessage(chatId, '❌ Unauthorized'); return
      }
      await this.bot?.sendMessage(chatId, '📊 Google Sheets sync queued. Check admin Sync Logs.')
      await this.logCommand(chatId, '/sync_sheets')
    })

    this.bot.onText(/\/api_health/, async (msg) => {
      const chatId = msg.chat.id.toString()
      const latest = await this.prisma.systemHealthLog.findFirst({
        where: { service: 'api' },
        orderBy: { checkedAt: 'desc' },
      })
      const status = latest?.status ?? 'UP'
      await this.bot?.sendMessage(
        chatId,
        `🩺 API Health: <b>${status}</b>${latest?.responseMs ? `\nResponse: ${latest.responseMs}ms` : ''}`,
        { parse_mode: 'HTML' },
      )
    })

    this.logger.log('Telegram commands registered')
  }

  async handleWebhookUpdate(_body: unknown): Promise<void> {
    // Webhook mode — polling used when TELEGRAM_BOT_TOKEN is set locally
  }

  private async replyAgentChat(chatId: string, text: string, telegramUserId?: string): Promise<void> {
    const authorized = await this.checkPermission(chatId, ['SUPER_ADMIN', 'MANAGER'])
    if (!authorized) return

    const storeId = await this.getStoreIdByChatId(chatId)
    if (!storeId) return

    try {
      await this.bot?.sendChatAction(chatId, 'typing')
      const agent = this.moduleRef.get(AgentService, { strict: false })
      const reply = await agent.handleTelegramMessage(storeId, chatId, text)
      await this.bot?.sendMessage(chatId, reply.slice(0, 3900), { parse_mode: 'HTML' })
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

  private async checkPermission(chatId: string, allowedRoles: TelegramRole[]): Promise<boolean> {
    const user = await this.prisma.telegramUser.findFirst({
      where: { telegramId: chatId, isActive: true },
    })
    return user !== null && allowedRoles.includes(user.role)
  }

  private async getStoreIdByChatId(chatId: string): Promise<string | null> {
    const config = await this.prisma.telegramConfig.findFirst({
      where: { chatId, isActive: true },
    })
    return config?.storeId ?? null
  }

  private async logCommand(chatId: string, command: string, userId?: string): Promise<void> {
    const config = await this.prisma.telegramConfig.findFirst({ where: { chatId } })
    if (!config) return
    await this.prisma.telegramLog.create({
      data: { configId: config.id, type: 'COMMAND', command, userId, message: command, success: true },
    })
  }
}
