import { NextResponse } from 'next/server'
import { addCartItemOnApi } from '@/lib/server/api-cart'

interface RouteContext {
  params: Promise<{ sessionId: string }>
}

interface AddItemBody {
  productId?: string
  variantId?: string
  quantity?: number
}

export async function POST(request: Request, context: RouteContext) {
  const { sessionId } = await context.params
  if (!sessionId?.trim()) {
    return NextResponse.json({ error: 'Missing cart session' }, { status: 400 })
  }

  let body: AddItemBody
  try {
    body = (await request.json()) as AddItemBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.productId?.trim()) {
    return NextResponse.json({ error: 'productId is required' }, { status: 400 })
  }

  try {
    const item = {
      productId: body.productId.trim(),
      quantity: Math.max(1, body.quantity ?? 1),
      ...(body.variantId?.trim() ? { variantId: body.variantId.trim() } : {}),
    }
    const upstream = await addCartItemOnApi(sessionId, item)
    const payload = await upstream.text()
    return new NextResponse(payload, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
    })
  } catch {
    return NextResponse.json({ error: 'Cart service unavailable' }, { status: 503 })
  }
}
