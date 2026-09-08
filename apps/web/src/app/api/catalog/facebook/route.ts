import { NextResponse } from 'next/server'
import { getStorefrontCatalog } from '@/lib/catalog/server'
import { buildFacebookCatalogCsvFromStorefront } from '@/lib/catalog/facebook-catalog-feed'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { products } = await getStorefrontCatalog()
    const csv = buildFacebookCatalogCsvFromStorefront(products)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800',
        'Content-Disposition': 'inline; filename="splaro-meta-catalog.csv"',
      },
    })
  } catch {
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
