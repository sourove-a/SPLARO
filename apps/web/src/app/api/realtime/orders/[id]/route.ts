import { NextResponse } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'
import { getPhoneAccessToken, getSessionToken } from '@/lib/server/api-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Order id is required' }, { status: 400 })
  }

  const sessionToken = await getSessionToken()
  const phoneAccessToken = await getPhoneAccessToken()
  const incoming = new URL(request.url)
  const upstream = new URL(
    `${getServerApiBaseUrl().replace(/\/+$/, '')}/realtime/orders/${encodeURIComponent(id.trim())}`,
  )
  upstream.searchParams.set('storeId', STORE_ID)
  const key = incoming.searchParams.get('key')?.trim()
  const phone = incoming.searchParams.get('phone')?.trim()
  if (key) upstream.searchParams.set('key', key)
  if (phone) upstream.searchParams.set('phone', phone)

  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
  }
  if (sessionToken) headers['x-splaro-session'] = sessionToken
  if (phoneAccessToken) headers['x-splaro-phone-access'] = phoneAccessToken

  try {
    const upstreamRes = await fetch(upstream, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: request.signal,
    })

    const responseHeaders = new Headers()
    const upstreamType = upstreamRes.headers.get('content-type')
    if (upstreamType) responseHeaders.set('Content-Type', upstreamType)
    if (upstreamType?.includes('text/event-stream')) {
      responseHeaders.set('Cache-Control', 'no-cache, no-transform')
      responseHeaders.set('Connection', 'keep-alive')
      responseHeaders.set('X-Accel-Buffering', 'no')
    }

    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    })
  } catch (err) {
    if (request.signal.aborted) {
      return new NextResponse(null, { status: 204 })
    }
    const message = err instanceof Error ? err.message : 'Realtime upstream failed'
    return NextResponse.json(
      { error: `Order realtime unavailable — ${message}` },
      { status: 503 },
    )
  }
}
