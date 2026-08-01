import { getApiBaseUrl } from '@splaro/config'
import { DEFAULT_SUPPORT_EMAIL } from '@/lib/storefront/defaults'

async function readPaymentError(res: Response): Promise<string> {
  const payload = (await res.json().catch(() => null)) as {
    message?: string | string[]
    error?: string
  } | null
  if (Array.isArray(payload?.message)) return payload.message.join('; ')
  return payload?.message ?? payload?.error ?? `Payment failed (${res.status})`
}

/** Same-origin BFF — never call Nest `:4000` from the browser. */
function bffPaymentsBase(): string {
  if (typeof window !== 'undefined') return '/api/payments'
  return `${getApiBaseUrl().replace(/\/api\/v1\/?$/, '')}/api/payments`
}

export async function startBkashCheckout(input: {
  orderId: string
  accessKey: string
}): Promise<{ redirectUrl: string; paymentId: string }> {
  const res = await fetch(`${bffPaymentsBase()}/bkash/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: input.orderId,
      accessKey: input.accessKey,
    }),
  })
  if (!res.ok) throw new Error(await readPaymentError(res))
  const data = (await res.json()) as {
    redirectUrl?: string
    paymentId?: string
    bkashURL?: string
    paymentID?: string
  }
  const redirectUrl = data.redirectUrl ?? data.bkashURL
  const paymentId = data.paymentId ?? data.paymentID
  if (!redirectUrl) throw new Error('bKash did not return a payment URL')
  return { redirectUrl, paymentId: paymentId ?? '' }
}

export async function startNagadCheckout(input: {
  orderId: string
  accessKey: string
}): Promise<{ redirectUrl: string; paymentRefId: string }> {
  const res = await fetch(`${bffPaymentsBase()}/nagad/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: input.orderId,
      accessKey: input.accessKey,
    }),
  })
  if (!res.ok) throw new Error(await readPaymentError(res))
  const data = (await res.json()) as {
    redirectUrl?: string
    paymentId?: string
    paymentRefId?: string
  }
  if (!data.redirectUrl) throw new Error('Nagad did not return a payment URL')
  return {
    redirectUrl: data.redirectUrl,
    paymentRefId: data.paymentRefId ?? data.paymentId ?? '',
  }
}

export async function startSslCommerzCheckout(input: {
  orderId: string
  accessKey: string
  customer?: {
    name: string
    email: string
    phone: string
    address: string
    city: string
  }
}): Promise<{ gatewayUrl: string }> {
  const res = await fetch(`${bffPaymentsBase()}/sslcommerz/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: input.orderId,
      accessKey: input.accessKey,
      customer: input.customer
        ? {
            ...input.customer,
            email: input.customer.email || DEFAULT_SUPPORT_EMAIL,
          }
        : undefined,
    }),
  })
  if (!res.ok) throw new Error(await readPaymentError(res))
  const data = (await res.json()) as { gatewayUrl?: string }
  if (!data.gatewayUrl) throw new Error('SSLCommerz did not return a gateway URL')
  return { gatewayUrl: data.gatewayUrl }
}
