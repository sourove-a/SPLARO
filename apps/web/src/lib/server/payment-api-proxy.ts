import { getServerApiBaseUrl, resolveCustomerFacingApiBase } from '@splaro/config'
import { fetchWithTimeout } from '@/lib/server/build-safe-fetch'
import { DEFAULT_SUPPORT_EMAIL } from '@/lib/storefront/defaults'

/** Server→Nest loopback OK for the API call itself. */
function paymentsApiBase(): string {
  return `${getServerApiBaseUrl()}/payments`
}

/** Gateway-facing URLs must be publicly reachable — never 127.0.0.1. */
function paymentsCallbackBase(): string {
  return `${resolveCustomerFacingApiBase()}/payments`
}

async function readApiError(res: Response): Promise<string> {
  const payload = (await res.json().catch(() => null)) as {
    message?: string | string[]
    error?: string
  } | null
  if (Array.isArray(payload?.message)) return payload.message.join('; ')
  return payload?.message ?? payload?.error ?? `Payment API failed (${res.status})`
}

export async function createBkashViaApi(input: {
  invoiceNumber: string
  amount: number
}): Promise<{ paymentID: string; bkashURL: string }> {
  const res = await fetchWithTimeout(`${paymentsApiBase()}/bkash/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoiceNumber: input.invoiceNumber,
      amount: input.amount,
      callbackUrl: `${paymentsCallbackBase()}/bkash/callback`,
    }),
    cache: 'no-store',
  })
  if (!res) throw new Error('bKash payment service timed out')
  if (!res.ok) throw new Error(await readApiError(res))
  return (await res.json()) as { paymentID: string; bkashURL: string }
}

export async function initNagadViaApi(input: {
  invoiceNumber: string
  amount: number
}): Promise<{ url: string; paymentRefId: string }> {
  const callbackUrl = `${paymentsCallbackBase()}/nagad/verify?invoiceNumber=${encodeURIComponent(input.invoiceNumber)}`
  const res = await fetchWithTimeout(`${paymentsApiBase()}/nagad/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoiceNumber: input.invoiceNumber,
      amount: input.amount,
      callbackUrl,
    }),
    cache: 'no-store',
  })
  if (!res) throw new Error('Nagad payment service timed out')
  if (!res.ok) throw new Error(await readApiError(res))
  return (await res.json()) as { url: string; paymentRefId: string }
}

export async function initSslCommerzViaApi(input: {
  invoiceNumber: string
  amount: number
  customer: {
    name: string
    email: string
    phone: string
    address: string
    city: string
  }
}): Promise<{ gatewayUrl: string; sessionKey: string }> {
  const apiBase = paymentsApiBase()
  const callbackBase = paymentsCallbackBase()
  const res = await fetchWithTimeout(`${apiBase}/ssl/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoiceNumber: input.invoiceNumber,
      amount: input.amount,
      customerName: input.customer.name,
      customerEmail: input.customer.email || DEFAULT_SUPPORT_EMAIL,
      customerPhone: input.customer.phone,
      customerAddress: input.customer.address,
      customerCity: input.customer.city,
      successUrl: `${callbackBase}/ssl/success`,
      failUrl: `${callbackBase}/ssl/fail`,
      cancelUrl: `${callbackBase}/ssl/cancel`,
    }),
    cache: 'no-store',
  })
  if (!res) throw new Error('SSLCommerz payment service timed out')
  if (!res.ok) throw new Error(await readApiError(res))
  return (await res.json()) as { gatewayUrl: string; sessionKey: string }
}
