import { NextResponse } from 'next/server'
import { getStorefrontCatalog } from '@/lib/catalog/server'
import { fetchProductsByIds, fetchStorefrontProductListing } from '@/lib/catalog/live'
import { LISTING_PAGE_SIZE } from '@/lib/catalog/listing'
import { getStaleCatalog } from '@/lib/catalog/catalog-stale'

function staleListingFallback() {
  const stale = getStaleCatalog()
  if (!stale?.products.length) return null
  return {
    products: stale.products,
    total: stale.total ?? stale.products.length,
    totalPages: stale.totalPages ?? 1,
    page: stale.page ?? 1,
    source: 'stale-cache' as const,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const idsParam = searchParams.get('ids')
  const ids = (idsParam ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  if (ids.length) {
    try {
      const products = await fetchProductsByIds(ids)
      return NextResponse.json(
        { products, total: products.length, source: products.length ? 'api' : 'empty' },
        { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } },
      )
    } catch {
      const stale = staleListingFallback()
      if (stale) {
        return NextResponse.json(stale, {
          headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
        })
      }
      return NextResponse.json(
        { products: [], total: 0, source: 'api-unavailable' },
        { status: 503 },
      )
    }
  }

  const collectionSlug = searchParams.get('collectionSlug') ?? undefined
  const categorySlug = searchParams.get('categorySlug') ?? undefined
  const parentCategorySlug = searchParams.get('parentCategorySlug') ?? undefined
  const page = Math.max(Number(searchParams.get('page') ?? 1), 1)
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? LISTING_PAGE_SIZE), 1), 100)

  // Any page/limit/filter must hit Nest pagination — never pull the full catalog then slice.
  const useListing = Boolean(
    collectionSlug ||
      categorySlug ||
      parentCategorySlug ||
      searchParams.has('page') ||
      searchParams.has('limit'),
  )

  if (useListing) {
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
      // Listing failures must not fall back to the unfiltered stale catalog.
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
