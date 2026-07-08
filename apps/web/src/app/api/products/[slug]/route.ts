import { NextResponse } from 'next/server'
import { fetchLiveProductDetailBySlug } from '@/lib/catalog/live'

interface RouteContext {
  params: Promise<{ slug: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params

  try {
    const live = await fetchLiveProductDetailBySlug(slug)
    if (live) {
      return NextResponse.json({
        product: live.product,
        reviews: live.reviews,
        source: 'api',
      })
    }
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  } catch {
    return NextResponse.json(
      { error: 'Product catalog is temporarily unavailable' },
      { status: 503 },
    )
  }
}
