import { getApiBaseUrl } from '@splaro/config'

function paymentsBase(): string {
  return `${getApiBaseUrl()}/payments`
}

async function readPaymentError(res: Response): Promise<string> {
  const payload = (await res.json().catch(() => null)) as {
    message?: string | string[]
    error?: string
  } | null
  if (Array.isArray(payload?.message)) return payload.message.join('; ')
  return payload?.message ?? payload?.error ?? `Payment failed (${res.status})`
}

export async function startBkashCheckout(input: {
  invoiceNumber: string
  amount: number
}): Promise<{ redirectUrl: string; paymentId: string }> {
  const base = paymentsBase()
  const res = await fetch(`${base}/bkash/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoiceNumber: input.invoiceNumber,
      amount: input.amount,
      callbackUrl: `${base}/bkash/callback`,
    }),
  })
  if (!res.ok) throw new Error(await readPaymentError(res))
  const data = (await res.json()) as { paymentID: string; bkashURL: string }
  if (!data.bkashURL) throw new Error('bKash did not return a payment URL')
  return { redirectUrl: data.bkashURL, paymentId: data.paymentID }
}

export async function startNagadCheckout(input: {
  invoiceNumber: string
  amount: number
}): Promise<{ redirectUrl: string; paymentRefId: string }> {
  const base = paymentsBase()
  const callbackUrl = `${base}/nagad/verify?invoiceNumber=${encodeURIComponent(input.invoiceNumber)}`
  const res = await fetch(`${base}/nagad/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoiceNumber: input.invoiceNumber,
      amount: input.amount,
      callbackUrl,
    }),
  })
  if (!res.ok) throw new Error(await readPaymentError(res))
  const data = (await res.json()) as { url: string; paymentRefId: string }
  if (!data.url) throw new Error('Nagad did not return a payment URL')
  return { redirectUrl: data.url, paymentRefId: data.paymentRefId }
}

export async function startSslCommerzCheckout(input: {
  invoiceNumber: string
  amount: number
  customer: {
    name: string
    email: string
    phone: string
    address: string
    city: string
  }
}): Promise<{ gatewayUrl: string }> {
  const base = paymentsBase()
  const res = await fetch(`${base}/ssl/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoiceNumber: input.invoiceNumber,
      amount: input.amount,
      customerName: input.customer.name,
      customerEmail: input.customer.email || 'hello@splaro.co',
      customerPhone: input.customer.phone,
      customerAddress: input.customer.address,
      customerCity: input.customer.city,
      successUrl: `${base}/ssl/success`,
      failUrl: `${base}/ssl/fail`,
      cancelUrl: `${base}/ssl/cancel`,
    }),
  })
  if (!res.ok) throw new Error(await readPaymentError(res))
  const data = (await res.json()) as { gatewayUrl: string }
  if (!data.gatewayUrl) throw new Error('SSLCommerz did not return a gateway URL')
  return { gatewayUrl: data.gatewayUrl }
}
