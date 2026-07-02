import { NextResponse } from 'next/server'
import { fetchCartFromApi } from '@/lib/server/api-cart'

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
