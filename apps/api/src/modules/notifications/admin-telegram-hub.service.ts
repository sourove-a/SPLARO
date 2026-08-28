import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { TelegramService } from '../telegram/telegram.service'
import { formatBDT } from '../../common/utils/currency'
import { escapeTelegramHtml } from '../telegram/telegram.util'
import type { OrderStatus } from '@prisma/client'
import { NotificationsService } from './notifications.service'

const STATUS_EMOJI: Record<string, string> = {
  PENDING: '⏳',
  CONFIRMED: '✅',
  PROCESSING: '🔧',
  COURIER_BOOKED: '🚚',
  IN_TRANSIT: '📦',
  OUT_FOR_DELIVERY: '🛵',
  DELIVERED: '🎉',
  CANCELLED: '❌',
  RETURNED: '🔄',
  REFUNDED: '💸',
}

@Injectable()
export class AdminTelegramHubService {
  private readonly logger = new Logger(AdminTelegramHubService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegram: TelegramService,
    private readonly notifications: NotificationsService,
  ) {}

  async notifyOrderDeleted(
    storeId: string,
    order: { invoiceNumber: string; shippingName: string; total: unknown; status: string },
    deletedBy?: string,
  ): Promise<void> {
    if (!(await this.flag(storeId, 'notifyOrders'))) return

    const msg = `
🗑 <b>Order Deleted</b>

Order: <code>${order.invoiceNumber}</code>
Customer: ${order.shippingName}
Total: <b>${formatBDT(Number(order.total))}</b>
Was: ${order.status.replace(/_/g, ' ')}${deletedBy ? `\nBy: ${deletedBy}` : ''}

<i>This action cannot be undone.</i>
`.trim()

    await this.safeSend(storeId, msg)
  }

  async notifyOrderStatusChanged(
    storeId: string,
    order: { invoiceNumber: string; shippingName: string; shippingPhone: string; total: unknown },
    newStatus: OrderStatus,
    note?: string,
  ): Promise<void> {
    if (!(await this.flag(storeId, 'notifyOrders'))) return

    const emoji = STATUS_EMOJI[newStatus] ?? '📋'
    const msg = `
${emoji} <b>Order ${newStatus.replace(/_/g, ' ')}</b>

Order: <code>${order.invoiceNumber}</code>
Customer: ${order.shippingName}
Phone: <code>${order.shippingPhone}</code>
Total: <b>${formatBDT(Number(order.total))}</b>${note ? `\nNote: ${note}` : ''}

<i>/order ${order.invoiceNumber} · /book_courier ${order.invoiceNumber}</i>
`.trim()

    await this.safeSend(storeId, msg)
  }

  /**
   * Wholesale / export enquiry. Always lands in the notification tray — a bulk
   * buyer waiting on a reply is worth more than one retail order, so it must not
   * depend on the customer-notification flag being on.
   */
  async notifyWholesaleInquiry(
    storeId: string,
    input: {
      fullName: string
      companyName?: string
      industry: string
      country: string
      phone: string
      email?: string
      productInterest?: string
      monthlyQuantity?: string
      message?: string
      photoCount?: number
      referenceCode?: string | null
      monthlyUnits?: number | null
      tierName?: string | null
    },
  ): Promise<void> {
    const who = input.companyName ? `${input.fullName} · ${input.companyName}` : input.fullName
    // Volume is the first thing worth knowing about a wholesale lead, so the
    // structured number wins over whatever free text the buyer typed.
    const volume = input.monthlyUnits
      ? `${input.monthlyUnits.toLocaleString('en-US')}/mo`
      : input.monthlyQuantity

    await this.notifications.notifyInApp({
      storeId,
      subject: input.referenceCode
        ? `Wholesale ${input.referenceCode} · ${who}`
        : `Wholesale enquiry · ${who}`,
      body: [input.industry, input.country, input.phone, volume, input.tierName]
        .filter(Boolean)
        .join(' · '),
      href: '/dashboard/wholesale-leads',
    })

    const lines = [
      '🏭 <b>New Wholesale / Export Enquiry</b>',
      '',
      ...(input.referenceCode
        ? [`Ref: <code>${escapeTelegramHtml(input.referenceCode)}</code>`]
        : []),
      `Name: ${escapeTelegramHtml(input.fullName)}`,
      ...(input.companyName ? [`Company: ${escapeTelegramHtml(input.companyName)}`] : []),
      `Industry: ${escapeTelegramHtml(input.industry)}`,
      `Country: ${escapeTelegramHtml(input.country)}`,
      `Phone: <code>${escapeTelegramHtml(input.phone)}</code>`,
      ...(input.email ? [`Email: <code>${escapeTelegramHtml(input.email)}</code>`] : []),
      ...(input.productInterest
        ? [`Interest: ${escapeTelegramHtml(input.productInterest)}`]
        : []),
      ...(volume ? [`Monthly qty: ${escapeTelegramHtml(volume)}`] : []),
      ...(input.tierName ? [`Tier: ${escapeTelegramHtml(input.tierName)}`] : []),
      ...(input.photoCount && input.photoCount > 0 ? [`Photos: ${input.photoCount}`] : []),
      ...(input.message ? ['', escapeTelegramHtml(input.message.slice(0, 500))] : []),
      '',
      '<i>Admin → Wholesale → Wholesale Leads</i>',
    ]

    await this.safeSend(storeId, lines.join('\n'))
  }

  async notifyCustomerRegistered(
    storeId: string,
    input: { name: string; email: string; phone: string; source?: string },
  ): Promise<void> {
    const customerHref = `/dashboard/customers?search=${encodeURIComponent(input.email || input.phone)}` as const
    await this.notifications.notifyInApp({
      storeId,
      subject: `New customer · ${input.name}`,
      body: `${input.email} · ${input.phone} · ${input.source ?? 'Website signup'}`,
      href: customerHref,
    })

    if (!(await this.flag(storeId, 'notifyCustomers'))) return

    const msg = `
👤 <b>New Customer Account</b>

Name: ${input.name}
Email: <code>${input.email}</code>
Phone: <code>${input.phone}</code>
Source: ${input.source ?? 'Website signup'}

<i>Customer registered — you can manage them from admin panel.</i>
`.trim()

    await this.safeSend(storeId, msg)
  }

  async notifyCustomerEmailVerification(
    storeId: string,
    input: { name: string; email: string; status: 'REQUESTED' | 'VERIFIED' },
  ): Promise<void> {
    if (!(await this.flag(storeId, 'notifyCustomers'))) return

    const requested = input.status === 'REQUESTED'
    const msg = `
${requested ? '📨' : '🛡'} <b>Email Verification ${requested ? 'Requested' : 'Completed'}</b>

Customer: ${escapeTelegramHtml(input.name)}
Email: <code>${escapeTelegramHtml(input.email)}</code>
Status: <b>${requested ? 'Link sent' : 'Verified'}</b>

<i>${requested ? 'Verification link stays private and is never sent to Telegram.' : 'Verified email is now locked on customer account.'}</i>
`.trim()

    await this.safeSend(storeId, msg)
  }

  async notifyNewReview(
    storeId: string,
    input: {
      productName: string
      productSlug: string
      customerName: string
      rating: number
      excerpt: string
      verifiedPurchase?: boolean
    },
  ): Promise<void> {
    if (!(await this.flag(storeId, 'notifyReviews'))) return

    const stars = '★'.repeat(input.rating) + '☆'.repeat(5 - input.rating)
    const msg = `
⭐ <b>New Product Review</b>

Product: <b>${input.productName}</b>
Rating: ${stars} (${input.rating}/5)
Customer: ${input.customerName}${input.verifiedPurchase ? ' · ✓ Verified purchase' : ''}

"${input.excerpt.slice(0, 200)}${input.excerpt.length > 200 ? '…' : ''}"

<i>Pending approval — Admin → Product Reviews</i>
`.trim()

    await this.safeSend(storeId, msg)
  }

  async notifyReturnRequest(
    storeId: string,
    input: {
      rmaNumber: string
      invoiceNumber: string
      type: 'RETURN' | 'EXCHANGE'
      customerName: string
      reason: string
      items: string[]
    },
  ): Promise<void> {
    const label = input.type === 'EXCHANGE' ? 'Exchange' : 'Return'

    await this.notifications.notifyInApp({
      storeId,
      subject: `${label} requested · ${input.invoiceNumber}`,
      body: [input.customerName, input.reason].filter(Boolean).join(' · '),
      href: '/dashboard/returns-rma',
      level: 'warn',
    })

    if (!(await this.flag(storeId, 'notifyOrders'))) return

    const lines = [
      `\u{1F4E6} <b>${label} Requested</b>`,
      '',
      `RMA: <code>${escapeTelegramHtml(input.rmaNumber)}</code>`,
      `Order: <code>${escapeTelegramHtml(input.invoiceNumber)}</code>`,
      `Customer: ${escapeTelegramHtml(input.customerName)}`,
      `Reason: ${escapeTelegramHtml(input.reason.slice(0, 200))}`,
      ...(input.items.length
        ? ['', ...input.items.slice(0, 10).map((item) => `\u2022 ${escapeTelegramHtml(item)}`)]
        : []),
      '',
      '<i>Admin \u2192 Orders \u2192 Returns & RMA</i>',
    ]

    await this.safeSend(storeId, lines.join('\n'))
  }

  async notifyAdminError(
    storeId: string,
    subject: string,
    error: string,
    context?: { invoiceNumber?: string; orderId?: string; area?: string },
  ): Promise<void> {
    const msg = `
🔴 <b>${subject}</b>

${context?.area ? `Area: ${context.area}\n` : ''}${context?.invoiceNumber ? `Order: <code>${context.invoiceNumber}</code>\n` : ''}Error: ${error.slice(0, 500)}

<i>Check API is running: pnpm dev:stack</i>
`.trim()

    await this.safeSend(storeId, msg)
  }

  /**
   * A 5xx or a process-level crash. Goes to every admin chat regardless of the
   * per-topic notify flags — those are merchandising preferences, and an API
   * that is throwing is not something the shop can opt out of hearing about.
   */
  async notifyServerError(input: {
    method: string
    route: string
    url: string
    statusCode: number
    message: string
    frames: string[]
    requestId?: string
    repeats: number
    windowMinutes: number
  }): Promise<void> {
    const storeId = await this.defaultStoreId()
    if (!storeId) return

    await this.notifications.notifyInApp({
      storeId,
      subject: `API ${input.statusCode} \u00B7 ${input.method} ${input.route}`,
      body: input.message.slice(0, 300),
      href: '/dashboard/api-health',
      level: 'critical',
      dedupeWindowMinutes: input.windowMinutes,
    })

    const lines = [
      `\u{1F6A8} <b>API ${input.statusCode}</b>`,
      '',
      `<code>${escapeTelegramHtml(`${input.method} ${input.url}`.slice(0, 200))}</code>`,
      '',
      escapeTelegramHtml(input.message.slice(0, 400)),
      ...(input.frames.length
        ? ['', ...input.frames.map((frame) => `<code>${escapeTelegramHtml(frame.slice(0, 160))}</code>`)]
        : []),
      ...(input.requestId ? ['', `Request: <code>${escapeTelegramHtml(input.requestId)}</code>`] : []),
      ...(input.repeats
        ? [`Repeated ${input.repeats}\u00D7 while muted.`]
        : []),
      '',
      `<i>Next alert for this one no sooner than ${input.windowMinutes} min.</i>`,
    ]

    await this.safeSend(storeId, lines.join('\n'))
  }

  /** The hourly ceiling was hit — say so once instead of going silent. */
  async notifyServerErrorsMuted(input: {
    sentThisHour: number
    distinctErrors: number
  }): Promise<void> {
    const storeId = await this.defaultStoreId()
    if (!storeId) return

    await this.safeSend(
      storeId,
      [
        '\u{1F507} <b>API error alerts muted for this hour</b>',
        '',
        `${input.sentThisHour} alerts already sent, ${input.distinctErrors} distinct errors tracked.`,
        'Further errors are still logged \u2014 check the API logs.',
      ].join('\n'),
    )
  }

  private async defaultStoreId(): Promise<string | null> {
    const store = await this.prisma.store.findFirst({ select: { id: true } })
    return store?.id ?? null
  }

  async notifyBulkOperation(
    storeId: string,
    subject: string,
    summary: { total: number; success: number; failed: number },
    failures: Array<{ id: string; error: string }>,
  ): Promise<void> {
    const failLines =
      failures.length > 0
        ? `\n\nFailed:\n${failures
            .slice(0, 8)
            .map((f) => `• ${f.id.slice(0, 8)}… — ${f.error.slice(0, 80)}`)
            .join('\n')}`
        : ''

    const msg = `
📊 <b>${subject}</b>

Total: ${summary.total}
Success: ${summary.success}
Failed: ${summary.failed}${failLines}
`.trim()

    await this.safeSend(storeId, msg)
  }

  async notifyApiConnectionIssue(storeId: string, area: string, detail: string): Promise<void> {
    await this.notifyAdminError(storeId, 'API Connection Problem', detail, { area })
  }

  async notifyContactFormSubmission(
    storeId: string,
    input: {
      name: string
      email?: string
      phone?: string
      subject?: string
      message: string
    },
  ): Promise<boolean> {
    const contactLines = [
      input.email ? `Email: <code>${input.email}</code>` : null,
      input.phone ? `Phone: <code>${input.phone}</code>` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const msg = `
📩 <b>Contact Form Message</b>

Name: ${input.name}
${contactLines}${input.subject ? `\nSubject: ${input.subject}` : ''}

"${input.message.slice(0, 1500)}${input.message.length > 1500 ? '…' : ''}"

<i>From splaro.co/contact</i>
`.trim()

    return this.telegram.sendToStoreWithResult(storeId, msg)
  }

  private async flag(
    storeId: string,
    key: 'notifyOrders' | 'notifyCustomers' | 'notifyPayments' | 'notifyCourier' | 'notifyStock' | 'notifyReviews',
  ): Promise<boolean> {
    const cfg = await this.loadConfig(storeId)
    if (!cfg?.isActive) return false
    return Boolean(cfg[key])
  }

  private async loadConfig(storeId: string) {
    return this.prisma.telegramConfig.findUnique({ where: { storeId } })
  }

  private async safeSend(storeId: string, message: string): Promise<void> {
    try {
      await this.telegram.sendToStore(storeId, message)
    } catch (err) {
      this.logger.error(`Telegram hub send failed: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }
}
