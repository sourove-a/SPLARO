import { createHash } from 'node:crypto'
import type { StoredOrder, StoredOrderItem } from '@/lib/server/store'

function hashSha256(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return ''
  return createHash('sha256').update(normalized).digest('hex')
}

function normalizePhoneForCapi(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('880')) return digits
  if (digits.startsWith('0')) return `88${digits}`
  return `880${digits}`
}

export interface MetaCapiInput {
  eventName: 'Purchase' | 'AddToCart' | 'InitiateCheckout' | 'ViewContent'
  eventId: string
  eventSourceUrl?: string
  clientIp?: string
  userAgent?: string
  user: {
    email?: string
    phone?: string
    name?: string
    city?: string
    fbp?: string
    fbc?: string
  }
  customData?: {
    value?: number
    currency?: string
    content_type?: string
    content_name?: string
    contents?: Array<{
      id: string
      quantity: number
      item_price?: number
    }>
  }
}

/**
 * Legacy web-BFF Meta CAPI helper.
 * Purchase CAPI is owned by Nest `MetaCapiService` (COD on place-order,
 * digital on payment confirm) with event_id = invoiceNumber.
 * Do not call this from `/api/orders` — it would count unpaid checkouts.
 */
export async function sendMetaCapiEvent(input: MetaCapiInput): Promise<boolean> {
  const pixelId = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID
  const accessToken = process.env.META_CONVERSIONS_API_ACCESS_TOKEN || process.env.META_CAPI_TOKEN
  const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE

  if (!pixelId || !accessToken) {
    // Meta CAPI unconfigured — skip silently without error
    return false
  }

  const nameParts = (input.user.name ?? '').trim().split(/\s+/)
  const firstName = nameParts[0] ?? ''
  const lastName = nameParts.slice(1).join(' ') ?? ''

  const emailHash = input.user.email ? hashSha256(input.user.email) : undefined
  const phoneHash = input.user.phone ? hashSha256(normalizePhoneForCapi(input.user.phone)) : undefined
  const fnHash = firstName ? hashSha256(firstName) : undefined
  const lnHash = lastName ? hashSha256(lastName) : undefined
  const cityHash = input.user.city ? hashSha256(input.user.city) : undefined

  const userData: Record<string, unknown> = {}
  if (emailHash) userData.em = [emailHash]
  if (phoneHash) userData.ph = [phoneHash]
  if (fnHash) userData.fn = [fnHash]
  if (lnHash) userData.ln = [lnHash]
  if (cityHash) userData.ct = [cityHash]
  if (input.clientIp) userData.client_ip_address = input.clientIp
  if (input.userAgent) userData.client_user_agent = input.userAgent
  if (input.user.fbp) userData.fbp = input.user.fbp
  if (input.user.fbc) userData.fbc = input.user.fbc

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        event_source_url: input.eventSourceUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://splaro.co',
        action_source: 'website',
        user_data: userData,
        ...(input.customData
          ? {
              custom_data: {
                value: input.customData.value ?? 0,
                currency: input.customData.currency ?? 'BDT',
                content_type: input.customData.content_type ?? 'product',
                ...(input.customData.content_name ? { content_name: input.customData.content_name } : {}),
                ...(input.customData.contents ? { contents: input.customData.contents } : {}),
              },
            }
          : {}),
      },
    ],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  }

  try {
    const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    })

    return res.ok
  } catch {
    return false
  }
}

/**
 * Dispatch Purchase event to Meta CAPI when an order is created on server.
 */
export async function trackOrderPurchaseMetaCapi(
  order: StoredOrder,
  context?: {
    clientIp?: string | null | undefined
    userAgent?: string | null | undefined
    attribution?: Record<string, unknown> | null | undefined
  },
): Promise<void> {
  const contents = order.items.map((item: StoredOrderItem) => ({
    id: item.productId,
    quantity: item.quantity,
    item_price: item.price,
  }))

  const userObj: MetaCapiInput['user'] = {
    name: order.customer.name,
    email: order.customer.email,
    phone: order.customer.phone,
    city: order.customer.city,
  }

  const fbp = typeof context?.attribution?.fbp === 'string' ? context.attribution.fbp : undefined
  const fbc = typeof context?.attribution?.fbc === 'string' ? context.attribution.fbc : undefined

  if (fbp) userObj.fbp = fbp
  if (fbc) userObj.fbc = fbc

  await sendMetaCapiEvent({
    eventName: 'Purchase',
    eventId: order.invoiceNumber || order.id,
    eventSourceUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://splaro.co'}/checkout`,
    ...(context?.clientIp ? { clientIp: context.clientIp } : {}),
    ...(context?.userAgent ? { userAgent: context.userAgent } : {}),
    user: userObj,
    customData: {
      value: order.total,
      currency: 'BDT',
      content_type: 'product',
      contents,
    },
  }).catch(() => undefined)
}
