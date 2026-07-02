import { NextResponse } from 'next/server'
import { getStorefrontCatalog } from '@/lib/catalog/server'
import { fetchStorefrontProductListing } from '@/lib/catalog/live'
import { LISTING_PAGE_SIZE } from '@/lib/catalog/listing'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const collectionSlug = searchParams.get('collectionSlug') ?? undefined
  const categorySlug = searchParams.get('categorySlug') ?? undefined
  const parentCategorySlug = searchParams.get('parentCategorySlug') ?? undefined
  const page = Math.max(Number(searchParams.get('page') ?? 1), 1)
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? LISTING_PAGE_SIZE), 1), 100)

  const scoped = Boolean(collectionSlug || categorySlug || parentCategorySlug || searchParams.has('page'))

  if (scoped) {
    try {
      const listing = await fetchStorefrontProductListing({
        ...(collectionSlug ? { collectionSlug } : {}),
        ...(categorySlug ? { categorySlug } : {}),
        ...(parentCategorySlug ? { parentCategorySlug } : {}),
        page,
        limit,
      })

      return NextResponse.json(
        {
          products: listing.products,
          total: listing.total,
          totalPages: listing.totalPages,
          page: listing.page,
          source: listing.products.length ? 'api' : 'empty',
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
          },
        },
      )
    } catch {
      return NextResponse.json(
        { products: [], total: 0, totalPages: 0, page: 1, source: 'api-unavailable' },
        { status: 503 },
      )
    }
  }

  const { products, source } = await getStorefrontCatalog()
  return NextResponse.json(
    { products, total: products.length, source },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    },
  )
}
