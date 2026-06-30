import { NextResponse } from 'next/server'
import { getProductBySlug } from '@/lib/catalog'
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
  } catch {
    /* fall through */
  }

  const product = getProductBySlug(slug)
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  return NextResponse.json({ product, reviews: [], source: 'static' })
}
