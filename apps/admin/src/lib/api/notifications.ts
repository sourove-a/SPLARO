import { apiFetch, getStoreId } from './client'

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
