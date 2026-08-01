import { NextResponse } from 'next/server'
import { verifyInvoiceAccessToken } from '@splaro/config'
import { apiAuthMe, getSessionToken } from '@/lib/server/api-auth'
import { resolveOrderById } from '@/lib/server/orders'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  const sessionToken = await getSessionToken()
  const sessionUser = sessionToken ? await apiAuthMe(sessionToken) : null
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  const sessionPhone = sessionUser?.phone?.replace(/\D/g, '') ?? ''

  // Never authorize via raw query phone alone — require session phone, key, or session ownership.
  const order = await resolveOrderById(id, {
    accessKey: key,
    phone: sessionPhone.length >= 10 ? sessionUser?.phone : null,
    sessionToken,
  })

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const orderPhone = order.customer.phone.replace(/\D/g, '')
  const hasInvoiceKey = Boolean(
    key &&
      (verifyInvoiceAccessToken(order.id, key) ||
        verifyInvoiceAccessToken(order.invoiceNumber, key)),
  )
  const ownsOrder =
    (sessionUser && order.userId === sessionUser.id) ||
    (sessionUser &&
      order.customer.email &&
      sessionUser.email.toLowerCase() === order.customer.email.toLowerCase()) ||
    (sessionPhone.length >= 10 && sessionPhone === orderPhone) ||
    hasInvoiceKey

  if (!ownsOrder) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  return NextResponse.json({ order })
}
