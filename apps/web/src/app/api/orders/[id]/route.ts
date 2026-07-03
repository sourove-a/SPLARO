import { NextResponse } from 'next/server'
import { verifyInvoiceAccessToken } from '@splaro/config'
import { apiAuthMe, getSessionToken } from '@/lib/server/api-auth'
import { resolveOrderById } from '@/lib/server/orders'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  // Validate against the backend API session (same as /api/orders GET) —
  // the legacy file-based session store never contains API tokens, which
  // made this route 403 for every logged-in customer.
  const sessionToken = await getSessionToken()
  const sessionUser = sessionToken ? await apiAuthMe(sessionToken) : null
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  const queryPhone = searchParams.get('phone')?.replace(/\D/g, '') ?? ''
  const order = await resolveOrderById(id, {
    accessKey: key,
    phone: sessionUser?.phone ?? searchParams.get('phone'),
  })

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const sessionPhone = sessionUser?.phone?.replace(/\D/g, '') ?? ''
  const orderPhone = order.customer.phone.replace(/\D/g, '')
  const hasInvoiceKey = Boolean(key && verifyInvoiceAccessToken(order.id, key))
  const ownsOrder =
    (sessionUser && order.userId === sessionUser.id) ||
    (sessionUser &&
      order.customer.email &&
      sessionUser.email.toLowerCase() === order.customer.email.toLowerCase()) ||
    (sessionPhone.length >= 10 && sessionPhone === orderPhone) ||
    (queryPhone.length >= 10 && queryPhone === orderPhone) ||
    hasInvoiceKey

  if (!ownsOrder) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  return NextResponse.json({ order })
}
