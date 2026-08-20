import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { PrismaService } from '../../common/prisma.service'
import { RealtimePublisher } from '../../common/realtime/realtime.publisher'
import { AutomationService } from '../automation/automation.service'
import { LoyaltyService } from '../loyalty/loyalty.service'
import { NotificationsService } from '../notifications/notifications.service'
import { OrderNotificationsService } from '../notifications/order-notifications.service'
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
    @Optional()
    @Inject(forwardRef(() => AutomationService))
    private readonly automation: AutomationService,
    @Optional() private readonly loyalty: LoyaltyService,
    @Optional() private readonly notifications: NotificationsService,
    @Optional() private readonly telegramHub: AdminTelegramHubService,
    @Optional() private readonly webhooks: WebhooksService,
    @Optional() private readonly googleSync: GoogleSyncQueueService,
    @Optional() private readonly realtime: RealtimePublisher,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onOrderPlaced(storeId: string, orderId: string, customerEmail?: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, customer: true },
    })
    if (!order) return

    await this.fanOutOrderPlacedNotifications(
      storeId,
      orderId,
      order.invoiceNumber,
      customerEmail ?? order.customer?.email ?? undefined,
      order,
    )

    void this.realtime
      ?.publishOrderEvent({
        type: 'order.created',
        orderId: order.id,
        storeId,
        invoiceNumber: order.invoiceNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        updatedAt: order.updatedAt,
      })
      .catch(() => undefined)

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

  /**
   * Resolve OrderNotifications at call-time. Constructor injection is Optional
   * inside Telegram → OrderStatus → OrderEvents → OrderNotifications and Nest
   * leaves that Optional `undefined`, so Notification Center never got the row.
   */
  private async fanOutOrderPlacedNotifications(
    storeId: string,
    orderId: string,
    invoiceNumber: string,
    customerEmail: string | undefined,
    order: { shippingName: string; paymentMethod: string; total: unknown },
  ): Promise<void> {
    try {
      const fanout = this.moduleRef.get(OrderNotificationsService, { strict: false })
      if (fanout) {
        await fanout.onOrderPlaced(storeId, orderId, customerEmail)
        return
      }
    } catch (err: unknown) {
      this.logger.error(
        `Order notification resolve failed for ${invoiceNumber}: ${err instanceof Error ? err.message : err}`,
      )
    }

    try {
      await this.prisma.notificationDeliveryLog.create({
        data: {
          storeId,
          channel: 'IN_APP',
          recipient: `/dashboard/orders/${encodeURIComponent(invoiceNumber)}`,
          subject: `New order · ${invoiceNumber}`,
          body: `${order.shippingName} · ${order.paymentMethod.replace(/_/g, ' ')}`,
          status: 'DELIVERED',
          level: 'critical',
        },
      })
    } catch (err: unknown) {
      this.logger.error(
        `In-app new-order notice failed for ${invoiceNumber}: ${err instanceof Error ? err.message : err}`,
      )
    }
  }

  async onStatusChanged(storeId: string, orderId: string, newStatus: OrderStatus, note?: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, customer: true },
    })
    if (!order) return

    void this.realtime
      ?.publishOrderEvent({
        type: 'order.status_changed',
        orderId: order.id,
        storeId,
        invoiceNumber: order.invoiceNumber,
        status: newStatus,
        paymentStatus: order.paymentStatus,
        updatedAt: order.updatedAt,
      })
      .catch(() => undefined)

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

    void this.realtime
      ?.publishOrderEvent({
        type: 'order.payment_updated',
        orderId: order.id,
        storeId,
        invoiceNumber: order.invoiceNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        updatedAt: order.updatedAt,
      })
      .catch(() => undefined)

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
      const variants = await this.prisma.productVariant.findMany({
        where: { id: { in: variantIds }, product: { storeId } },
        include: { product: { select: { id: true, name: true, lowStockThreshold: true } } },
      })

      for (const variant of variants) {
        const threshold = variant.product.lowStockThreshold ?? 5
        if (variant.stock <= threshold) {
          await this.notifications?.notifyLowStock(
            storeId,
            variant.product.name,
            variant.sku ?? variant.id,
            variant.stock,
          )
          await this.webhooks?.dispatch(storeId, 'product.low_stock', {
            storeId,
            productId: variant.product.id,
            variantId: variant.id,
            productName: variant.product.name,
            sku: variant.sku,
            stock: variant.stock,
            threshold,
          })
          await this.automation?.runTrigger(storeId, 'STOCK_LOW', {
            storeId,
            productId: variant.product.id,
            variantId: variant.id,
            productName: variant.product.name,
            sku: variant.sku ?? variant.id,
            stock: variant.stock,
            threshold,
            triggeredBy: 'system',
          })
        }
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
