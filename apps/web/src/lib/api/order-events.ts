import { getApiBaseUrl } from '@splaro/config'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

export async function notifyOrderPaymentEvent(input: {
  invoiceNumber: string
  status: 'started' | 'returned' | 'failed'
  gateway?: string
}) {
  try {
    const base = getApiBaseUrl()
    await fetch(
      `${base}/storefront/orders/payment-event?storeId=${encodeURIComponent(STORE_ID)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    )
  } catch {
    // Non-blocking storefront telemetry
  }
}
