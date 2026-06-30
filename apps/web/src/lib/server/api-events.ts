import { getApiBaseUrl } from '@splaro/config'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

function internalHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const secret = process.env.INTERNAL_HEALTH_SECRET
  if (secret) headers['x-splaro-internal'] = secret
  return headers
}

/** Notify admin Telegram when a customer creates an account on the website. */
export async function notifyCustomerSignup(input: {
  name: string
  email: string
  phone: string
  passwordHash?: string
  source?: string
}): Promise<void> {
  const base = getApiBaseUrl()
  try {
    await fetch(
      `${base}/storefront/events/customer-signup?storeId=${encodeURIComponent(STORE_ID)}`,
      {
        method: 'POST',
        headers: internalHeaders(),
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(8000),
      },
    )
  } catch {
    /* Non-blocking — signup still succeeds if API is offline */
  }
}

/** Notify admin Telegram when storefront hits API connection issues. */
export async function notifyStorefrontApiError(area: string, detail: string): Promise<void> {
  const base = getApiBaseUrl()
  try {
    await fetch(
      `${base}/storefront/events/api-error?storeId=${encodeURIComponent(STORE_ID)}`,
      {
        method: 'POST',
        headers: internalHeaders(),
        body: JSON.stringify({ area, detail }),
        signal: AbortSignal.timeout(8000),
      },
    )
  } catch {
    /* ignore */
  }
}
