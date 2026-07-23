import { NextResponse } from 'next/server'
import { getServerApiBaseUrl, verifyInvoiceAccessToken } from '@splaro/config'
import { apiAuthMe, getSessionToken } from '@/lib/server/api-auth'
import { renderInvoiceHtml, resolveOrderById } from '@/lib/server/orders'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

interface RouteContext {
  params: Promise<{ id: string }>
}

async function fetchApiInvoiceHtml(
  orderId: string,
  opts: { key?: string | null; phone?: string | null },
): Promise<string | null> {
  try {
    const base = getServerApiBaseUrl()
    const params = new URLSearchParams({ storeId: STORE_ID })
    if (opts.key) params.set('key', opts.key)
    if (opts.phone) params.set('phone', opts.phone)
    const res = await fetch(
      `${base}/storefront/orders/${encodeURIComponent(orderId)}/invoice?${params.toString()}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  const sessionToken = await getSessionToken()
  const sessionUser = sessionToken ? await apiAuthMe(sessionToken) : null
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  const order = await resolveOrderById(id, {
    accessKey: key,
    phone: sessionUser?.phone ?? searchParams.get('phone'),
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
    phone: order.customer.phone,
  })

  const html = apiHtml ?? renderInvoiceHtml(order)
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
