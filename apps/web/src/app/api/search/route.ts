import { NextResponse } from 'next/server'
import { apiSearchProducts } from '@/lib/server/api-auth'
import { searchProducts } from '@/lib/catalog'
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import { sanitizeRemoteImageUrl } from '@/lib/assets/images'

function mapApiProduct(raw: Record<string, unknown>) {
  const images = (raw.images as { url?: string }[] | undefined) ?? []
  const imageUrl = sanitizeRemoteImageUrl(images[0]?.url) ?? PRODUCT_IMAGE_PLACEHOLDER
  const variants = (raw.variants as { price?: number | string }[] | undefined) ?? []
  const price = Number(raw.basePrice ?? variants[0]?.price ?? 0)

  return {
    id: String(raw.id),
    slug: String(raw.slug),
    name: String(raw.name),
    price,
    images: [imageUrl],
    colorOptions: [],
    isNewArrival: Boolean(raw.isNewArrival),
    isBestSeller: Boolean(raw.isBestSeller),
    isOnSale: Boolean(raw.isOnSale),
    rating: Number(raw.rating ?? 0),
    reviewCount: Number(raw.reviewCount ?? 0),
    category: (raw.category as { name?: string } | undefined)?.name ?? '',
    collectionSlug: '',
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 24), 1), 50)

  if (!q) {
    return NextResponse.json({ products: [], total: 0, query: '' })
  }

  const apiProducts = await apiSearchProducts(q, limit)
  if (apiProducts.length > 0) {
    const products = apiProducts.map(mapApiProduct)
    return NextResponse.json({ products, total: products.length, query: q, source: 'api' })
  }

  const local = searchProducts(q).slice(0, limit)
  return NextResponse.json({ products: local, total: local.length, query: q, source: 'local' })
}
