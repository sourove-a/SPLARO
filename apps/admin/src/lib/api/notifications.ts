import { apiFetch, getStoreId } from './client'

export interface NotificationLogItem {
  id: string
  channel: string
  recipient: string
  subject: string | null
  body: string
  status: string
  level: string
  createdAt: string
}

export interface NotificationChannelPreferences {
  emailEnabled: boolean
  smtpConfigured: boolean
  telegramEnabled: boolean
  telegramConfigured: boolean
}

export interface LowStockVariantAlert {
  id: string
  productId: string
  productName: string
  sku: string
  stock: number
  reorderPoint: number
  color: string | null
  size: string | null
}

export function sendTestSms(phone: string, message?: string) {
  return apiFetch<{ ok: boolean; provider: string | null; message: string }>(
    '/admin/notifications/test/sms',
    {
      method: 'POST',
      body: JSON.stringify({
        storeId: getStoreId(),
        phone,
        ...(message ? { message } : {}),
      }),
    },
  )
}

export function sendTestTelegram(message?: string) {
  return apiFetch<{ ok: boolean }>('/admin/notifications/test/telegram', {
    method: 'POST',
    body: JSON.stringify({
      storeId: getStoreId(),
      ...(message ? { message } : {}),
    }),
  })
}

export function sendTestEmail(to: string) {
  return apiFetch<{ ok: boolean; message: string }>('/admin/notifications/test/email', {
    method: 'POST',
    body: JSON.stringify({
      storeId: getStoreId(),
      to,
    }),
  })
}

export function verifySmtp(accountId?: string) {
  return apiFetch<{ ok: boolean; message: string }>('/admin/notifications/verify/smtp', {
    method: 'POST',
    body: JSON.stringify({
      storeId: getStoreId(),
      ...(accountId ? { accountId } : {}),
    }),
  })
}

export function fetchNotificationPreferences() {
  return apiFetch<NotificationChannelPreferences>(
    `/admin/notifications/preferences/${encodeURIComponent(getStoreId())}`,
  )
}

export function fetchLowStockAlerts() {
  return apiFetch<LowStockVariantAlert[]>(
    `/admin/notifications/low-stock?storeId=${encodeURIComponent(getStoreId())}`,
  )
}

export function triggerLowStockAlerts() {
  return apiFetch<{ triggered: number }>('/admin/notifications/trigger/low-stock', {
    method: 'POST',
    body: JSON.stringify({ storeId: getStoreId() }),
  })
}
