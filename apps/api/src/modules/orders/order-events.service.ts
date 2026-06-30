import { Injectable, Logger, Optional } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { AutomationService } from '../automation/automation.service'
import { LoyaltyService } from '../loyalty/loyalty.service'
import { NotificationsService } from '../notifications/notifications.service'
import { AdminTelegramHubService } from '../notifications/admin-telegram-hub.service'
import { WebhooksService, type WebhookEventType } from '../webhooks/webhooks.service'
import { GoogleSyncQueueService } from '../google-workspace/google-sync-queue.service'
import type { OrderStatus } from '@prisma/client'

const STATUS_TO_WEBHOOK: Partial<Record<OrderStatus, WebhookEventType>> = {
  CONFIRMED: 'order.confirmed',
  CANCELLED: 'order.cancelled',
  DELIVERED: 'order.delivered',
}

const STATUS_TO_TRIGGER: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: 'ORDER_CONFIRMED',
  DELIVERED: 'ORDER_DELIVERED',
  CANCELLED: 'ORDER_CANCELLED',
}

@Injectable()
export class OrderEventsService {
  private readonly logger = new Logger(OrderEventsService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly automation: AutomationService,
    @Optional() private readonly loyalty: LoyaltyService,
    @Optional() private readonly notifications: NotificationsService,
    @Optional() private readonly telegramHub: AdminTelegramHubService,
    @Optional() private readonly webhooks: WebhooksService,
    @Optional() private readonly googleSync: GoogleSyncQueueService,
  ) {}

  async onOrderPlaced(storeId: string, orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, customer: true },
    })
    if (!order) return

    const ctx = this.buildContext(order, storeId)

    // Fire automation rules
    await this.automation?.runTrigger(storeId, 'ORDER_PLACED', ctx)

    // Dispatch outgoing webhook
    await this.webhooks?.dispatch(storeId, 'order.created', ctx)

    // Google Sheets sync
    await this.googleSync?.onOrderPlaced(storeId, orderId).catch((e) =>
      this.logger.warn(`Google sync enqueue failed: ${e}`),
    )

    // Check stock after deduction
    await this.checkLowStock(storeId, order.items.map((i) => i.variantId).filter(Boolean) as string[])
  }

  async onStatusChanged(storeId: string, orderId: string, newStatus: OrderStatus, note?: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, customer: true },
    })
    if (!order) return

    const ctx = this.buildContext(order, storeId)

    // Automation
    const trigger = STATUS_TO_TRIGGER[newStatus]
    if (trigger && this.automation) {
      await this.automation.runTrigger(storeId, trigger as never, ctx)
    }

    // Webhook
    const webhookEvent = STATUS_TO_WEBHOOK[newStatus]
    if (webhookEvent) {
      await this.webhooks?.dispatch(storeId, webhookEvent, ctx)
    }

    // Loyalty points on delivery
    if (newStatus === 'DELIVERED' && order.customerId) {
      await this.awardLoyaltyPoints(storeId, orderId, order.customerId, Number(order.total))
    }

    // Telegram — all status changes
    void this.telegramHub?.notifyOrderStatusChanged(
      storeId,
      {
        invoiceNumber: order.invoiceNumber,
        shippingName: order.shippingName,
        shippingPhone: order.shippingPhone,
        total: order.total,
      },
      newStatus,
      note,
    )
  }

  async onPaymentReceived(storeId: string, orderId: string, amount: number, method: string): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) return

    await this.notifications?.notifyPaymentReceived(storeId, order.invoiceNumber, amount, method)
    await this.webhooks?.dispatch(storeId, 'payment.received', {
      orderId,
      invoiceNumber: order.invoiceNumber,
      amount,
      method,
      storeId,
    })
  }

  private async awardLoyaltyPoints(storeId: string, orderId: string, customerId: string, orderTotal: number): Promise<void> {
    try {
      const settings = await this.prisma.siteSettings.findUnique({
        where: { storeId },
        select: { loyaltyEnabled: true },
      })
      if (!settings?.loyaltyEnabled) return

      await this.loyalty?.awardOrderPoints(customerId, orderId, orderTotal)
      this.logger.log(`Awarded loyalty points to customer ${customerId} for order ${orderId}`)
    } catch (err) {
      this.logger.error(`Loyalty award failed: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  private async checkLowStock(storeId: string, variantIds: string[]): Promise<void> {
    if (variantIds.length === 0) return
    try {
      const threshold = 5
      const lowStockVariants = await this.prisma.productVariant.findMany({
        where: { id: { in: variantIds }, stock: { lte: threshold } },
        include: { product: { select: { name: true } } },
      })

      for (const variant of lowStockVariants) {
        await this.notifications?.notifyLowStock(
          storeId,
          variant.product.name,
          variant.sku ?? variant.id,
          variant.stock,
        )
        await this.webhooks?.dispatch(storeId, 'product.low_stock', {
          storeId,
          variantId: variant.id,
          productName: variant.product.name,
          sku: variant.sku,
          stock: variant.stock,
        })
      }
    } catch (err) {
      this.logger.error(`Low stock check failed: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  private buildContext(
    order: {
      id: string
      storeId: string
      invoiceNumber: string
      status: string
      shippingName: string
      shippingPhone: string
      shippingCity: string
      total: unknown
      customerId: string | null
      isCodRisk: boolean
      paymentMethod: string
      items: { variantId: string | null }[]
      customer: { id: string; email: string | null } | null
    },
    storeId: string,
  ): Record<string, unknown> {
    return {
      orderId: order.id,
      storeId,
      invoiceNumber: order.invoiceNumber,
      status: order.status,
      customerName: order.shippingName,
      phone: order.shippingPhone,
      city: order.shippingCity,
      total: Number(order.total),
      customerId: order.customerId,
      email: order.customer?.email ?? null,
      isCodRisk: order.isCodRisk,
      paymentMethod: order.paymentMethod,
      triggeredBy: 'system',
    }
  }
}
