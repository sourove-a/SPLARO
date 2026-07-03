import { NextResponse } from 'next/server'
import { fetchCartFromApi, replaceCartOnApi } from '@/lib/server/api-cart'

interface RouteContext {
  params: Promise<{ sessionId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params
  if (!sessionId?.trim()) {
    return NextResponse.json({ error: 'Missing cart session' }, { status: 400 })
  }

  try {
    const upstream = await fetchCartFromApi(sessionId)
    const body = await upstream.text()
    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
    })
  } catch {
    return NextResponse.json({ error: 'Cart service unavailable' }, { status: 503 })
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { sessionId } = await context.params
  if (!sessionId?.trim()) {
    return NextResponse.json({ error: 'Missing cart session' }, { status: 400 })
  }

  let body: { items?: { productId: string; variantId?: string; quantity: number }[] }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const upstream = await replaceCartOnApi(sessionId, body.items ?? [])
    const text = await upstream.text()
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
    })
  } catch {
    return NextResponse.json({ error: 'Cart service unavailable' }, { status: 503 })
  }
}
