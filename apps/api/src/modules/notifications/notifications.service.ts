import { Injectable, Logger, Optional } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { TelegramService } from '../telegram/telegram.service'

export interface AdminNotification {
  subject: string
  body: string
  storeId?: string
  orderId?: string
  level?: 'info' | 'warn' | 'error'
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly telegram: TelegramService,
  ) {}

  async notifyAdmin(input: AdminNotification): Promise<void> {
    const level = input.level ?? 'warn'
    this.logger[level](`${input.subject}: ${input.body}`)

    const storeId = input.storeId ?? (await this.getDefaultStoreId())
    if (!storeId) return

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
      subject: 'Low Stock Alert',
      body: `${productName} (${variantSku}) — only ${qty} left`,
      level: 'warn',
    })
  }

  async notifyCourierFailed(storeId: string, invoiceNumber: string, provider: string, error: string): Promise<void> {
    await this.notifyAdmin({
      storeId,
      subject: `Courier Failed: ${invoiceNumber}`,
      body: `Provider: ${provider}\nError: ${error}`,
      level: 'error',
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
