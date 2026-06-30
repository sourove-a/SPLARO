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

function supportPhone(): string {
  return (
    process.env.NEXT_PUBLIC_SUPPORT_PHONE ??
    process.env.COMPANY_PHONE ??
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ??
    ''
  )
}

export async function sendOrderConfirmation(order: StoredOrder): Promise<NotificationResult> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splaro.com.bd'
  const support = supportPhone()
  const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER)
  const smsConfigured = Boolean(process.env.SMS_API_KEY)
  const whatsappConfigured = Boolean(process.env.WHATSAPP_API_TOKEN)

  const summary = [
    `Order ${order.id} confirmed`,
    `Invoice ${order.invoiceNumber}`,
    `Total BDT ${order.total.toLocaleString('en-BD')}`,
    `Customer ${order.customer.name} (${order.customer.phone})`,
    `Payment ${order.payment.method}`,
    `Track ${siteUrl}/track-order?id=${encodeURIComponent(order.id)}&phone=${encodeURIComponent(order.customer.phone)}`,
  ].join(' · ')

  serverLog('notifications', 'order confirmation', { summary })

  if (smtpConfigured) {
    serverLog('notifications', 'email stub', {
      to: order.customer.email,
      from: process.env.EMAIL_FROM_ADDRESS ?? 'noreply@splaro.com.bd',
    })
  }

  if (smsConfigured) {
    serverLog('notifications', 'sms stub', {
      to: order.customer.phone,
      provider: process.env.SMS_PROVIDER ?? 'ssl_wireless',
    })
  }

  if (whatsappConfigured) {
    serverLog('notifications', 'whatsapp stub', {
      to: order.customer.phone,
      support,
    })
  }

  return {
    success: true,
    channels: {
      email: smtpConfigured,
      sms: smsConfigured,
      whatsapp: whatsappConfigured,
    },
    message: 'Order confirmation queued',
  }
}
