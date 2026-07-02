import type { StoredOrder } from '@/lib/server/store'
import { serverLog } from '@/lib/server/log'

export interface NotificationResult {
  success: boolean
  channels: {
    email: boolean
    sms: boolean
    whatsapp: boolean
  }
  message: string
}

/**
 * Order confirmation email/Telegram is sent by Nest API (`OrderNotificationsService.onOrderPlaced`)
 * when the order is created via `POST /storefront/orders`. Do not fake local delivery here.
 */
export async function sendOrderConfirmation(order: StoredOrder): Promise<NotificationResult> {
  serverLog('notifications', 'skipped local stub — Nest API sends confirmation for DB orders', {
    orderId: order.id,
    invoiceNumber: order.invoiceNumber,
  })

  return {
    success: false,
    channels: { email: false, sms: false, whatsapp: false },
    message: 'Confirmation is sent by SPLARO API when the order exists in the database.',
  }
}
