import { NextResponse } from 'next/server'
import {
  getServerApiBaseUrl,
} from '@splaro/config'
import {
  verifyInvoiceAccessToken,
} from '@splaro/config/invoice-access'
import { apiAuthMe, getSessionToken } from '@/lib/server/api-auth'
import { resolveOrderById } from '@/lib/server/orders'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'
const INVOICE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface RouteContext {
  params: Promise<{ id: string }>
}

async function fetchApiInvoiceHtml(
  orderId: string,
  opts: {
    key?: string | null
    phone?: string | null
    sessionToken?: string | null
  },
): Promise<string | null> {
  const base = getServerApiBaseUrl()
  const params = new URLSearchParams({ storeId: STORE_ID })
  if (opts.key) params.set('key', opts.key)
  if (opts.phone) params.set('phone', opts.phone)
  const url = `${base}/storefront/orders/${encodeURIComponent(orderId)}/invoice?${params.toString()}`
  const headers: Record<string, string> = {}
  if (opts.sessionToken) headers['x-splaro-session'] = opts.sessionToken

  // Deploy reloads can briefly replace API workers. Retry latest invoice
  // renderer instead of silently falling back to legacy storefront markup.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(url, { headers, cache: 'no-store' })
      if (res.ok) return await res.text()
      if (res.status < 500) return null
    } catch {
      // Retry below.
    }
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)))
    }
  }
  return null
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  const sessionToken = await getSessionToken()
  const sessionUser = sessionToken ? await apiAuthMe(sessionToken) : null
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  const order = await resolveOrderById(id, {
    accessKey: key,
    phone: sessionUser?.phone ?? null,
    sessionToken,
  })

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const sessionPhone = sessionUser?.phone?.replace(/\D/g, '') ?? ''
  const orderPhone = order.customer.phone.replace(/\D/g, '')
  const ownsOrder =
    (sessionUser && order.userId === sessionUser.id) ||
    (sessionUser &&
      order.customer.email &&
      sessionUser.email.toLowerCase() === order.customer.email.toLowerCase()) ||
    (sessionPhone.length >= 10 && sessionPhone === orderPhone)
  const hasInvoiceKey = Boolean(
    key &&
      (verifyInvoiceAccessToken(order.id, key) ||
        verifyInvoiceAccessToken(order.invoiceNumber, key)),
  )

  if (!ownsOrder && !hasInvoiceKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const apiHtml = await fetchApiInvoiceHtml(order.id, {
    key: hasInvoiceKey ? key : null,
    // A signed email link needs key auth only. Sending phone as well makes the
    // API require an OTP/session proof before it evaluates the valid key.
    phone: !hasInvoiceKey && ownsOrder ? order.customer.phone : null,
    sessionToken: !hasInvoiceKey && ownsOrder ? (sessionToken ?? null) : null,
  })

  if (!apiHtml) {
    return NextResponse.json(
      { error: 'Invoice is temporarily unavailable. Please retry.' },
      { status: 503, headers: INVOICE_HEADERS },
    )
  }

  return new NextResponse(apiHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...INVOICE_HEADERS,
    },
  })
}
