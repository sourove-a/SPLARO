import { Injectable, Logger, Optional } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { RealtimePublisher } from '../../common/realtime/realtime.publisher'
import { TelegramService } from '../telegram/telegram.service'

export interface AdminNotification {
  subject: string
  body: string
  storeId?: string
  orderId?: string
  level?: 'info' | 'warn' | 'error'
  /** Also drop a row in the admin tray, linking to this dashboard route. */
  inAppHref?: `/dashboard/${string}`
}

/** How urgently the admin tray should paint the row. */
export type NotificationLevel = 'info' | 'warn' | 'critical'

export interface InAppNotification {
  storeId: string
  subject: string
  body: string
  href: `/dashboard/${string}`
  level?: NotificationLevel
  /**
   * Suppress an identical alert raised inside this window. Omit for
   * once-ever alerts (a given order only ever lands once); set it for
   * recurring conditions like low stock, which must nag again later.
   */
  dedupeWindowMinutes?: number
}

const ADMIN_LEVEL_TO_TRAY: Record<'info' | 'warn' | 'error', NotificationLevel> = {
  info: 'info',
  warn: 'warn',
  error: 'critical',
}

/**
 * Nest's Logger exposes `log`, not `info`, so an alert raised at level 'info'
 * used to throw before it sent anything — which silently took out every
 * order-confirmed and payment-received notification.
 */
const LEVEL_TO_LOG_METHOD: Record<'info' | 'warn' | 'error', 'log' | 'warn' | 'error'> = {
  info: 'log',
  warn: 'warn',
  error: 'error',
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly telegram: TelegramService,
    @Optional() private readonly realtime?: RealtimePublisher,
  ) {}

  /** Persist a dashboard notification even when Telegram/email is disabled. */
  async notifyInApp(input: InAppNotification): Promise<boolean> {
    return (await this.persistInApp(input)) !== 'failed'
  }

  private async persistInApp(
    input: InAppNotification,
  ): Promise<'created' | 'duplicate' | 'failed'> {
    try {
      const existing = await this.prisma.notificationDeliveryLog.findFirst({
        where: {
          storeId: input.storeId,
          channel: 'IN_APP',
          recipient: input.href,
          subject: input.subject,
          ...(input.dedupeWindowMinutes
            ? {
                createdAt: {
                  gte: new Date(Date.now() - input.dedupeWindowMinutes * 60_000),
                },
              }
            : {}),
        },
        select: { id: true },
      })
      if (existing) return 'duplicate'

      await this.prisma.notificationDeliveryLog.create({
        data: {
          storeId: input.storeId,
          channel: 'IN_APP',
          recipient: input.href,
          subject: input.subject,
          body: input.body,
          status: 'DELIVERED',
          level: input.level ?? 'info',
        },
      })
      void this.realtime?.publishNotificationCreated(input.storeId)
      return 'created'
    } catch (error) {
      this.logger.error(
        `In-app notification persist failed: ${error instanceof Error ? error.message : 'unknown'}`,
      )
      return 'failed'
    }
  }

  async notifyAdmin(input: AdminNotification): Promise<void> {
    const level = input.level ?? 'warn'
    this.logger[LEVEL_TO_LOG_METHOD[level]](`${input.subject}: ${input.body}`)

    const storeId = input.storeId ?? (await this.getDefaultStoreId())
    if (!storeId) return

    if (input.inAppHref) {
      const outcome = await this.persistInApp({
        storeId,
        subject: input.subject,
        body: input.body,
        href: input.inAppHref,
        level: ADMIN_LEVEL_TO_TRAY[level],
        // Recurring conditions (low stock, a broken sync) are re-checked on a
        // schedule. Suppressing the repeat here is what keeps a four-hourly
        // sweep from turning into a four-hourly Telegram burst.
        dedupeWindowMinutes: 720,
      })
      if (outcome === 'duplicate') return
    }

    const emoji = level === 'error' ? '🔴' : level === 'warn' ? '🟡' : '🟢'
    const msg = `${emoji} <b>${input.subject}</b>\n${input.body}${input.orderId ? `\nOrder: ${input.orderId}` : ''}`

    await this.telegram?.sendToStore(storeId, msg).catch((e: unknown) => {
      this.logger.error(`Telegram notify failed: ${e instanceof Error ? e.message : 'unknown'}`)
    })
  }

  async notifyOrderConfirmed(storeId: string, invoiceNumber: string, customerName: string, total: number): Promise<void> {
    await this.notifyAdmin({
      storeId,
      subject: `New Order: ${invoiceNumber}`,
      body: `Customer: ${customerName}\nTotal: ৳${total.toLocaleString()}`,
      level: 'info',
    })
  }

  async notifyLowStock(storeId: string, productName: string, variantSku: string, qty: number): Promise<void> {
    await this.notifyAdmin({
      storeId,
      // SKU in the subject so each variant nags on its own line, not as one
      // rolled-up "Low Stock Alert" that dedupe would collapse.
      subject: qty <= 0 ? `Out of stock: ${variantSku}` : `Low stock: ${variantSku}`,
      body: `${productName} (${variantSku}) — only ${qty} left`,
      level: qty <= 0 ? 'error' : 'warn',
      inAppHref: '/dashboard/inventory',
    })
  }

  async notifyCourierFailed(storeId: string, invoiceNumber: string, provider: string, error: string): Promise<void> {
    await this.notifyAdmin({
      storeId,
      subject: `Courier Failed: ${invoiceNumber}`,
      body: `Provider: ${provider}\nError: ${error}`,
      level: 'error',
      inAppHref: '/dashboard/courier-hub',
    })
  }

  async notifySyncFailed(storeId: string, jobType: string, error: string): Promise<void> {
    await this.notifyAdmin({
      storeId,
      subject: `Google Sheets sync failed: ${jobType}`,
      body: error,
      level: 'error',
      inAppHref: '/dashboard/automation/google-sheets-sync',
    })
  }

  async notifyPaymentReceived(storeId: string, invoiceNumber: string, amount: number, method: string): Promise<void> {
    await this.notifyAdmin({
      storeId,
      subject: `Payment: ${invoiceNumber}`,
      body: `৳${amount.toLocaleString()} via ${method}`,
      level: 'info',
    })
  }

  private async getDefaultStoreId(): Promise<string | null> {
    const store = await this.prisma.store.findFirst({ select: { id: true } })
    return store?.id ?? null
  }
}
