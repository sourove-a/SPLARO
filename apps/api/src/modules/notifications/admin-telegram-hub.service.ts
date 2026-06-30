import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { TelegramService } from '../telegram/telegram.service'
import { formatBDT } from '../../common/utils/currency'
import type { OrderStatus } from '@prisma/client'

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
    private readonly telegram: TelegramService,
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

  async notifyCustomerRegistered(
    storeId: string,
    input: { name: string; email: string; phone: string; source?: string },
  ): Promise<void> {
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
