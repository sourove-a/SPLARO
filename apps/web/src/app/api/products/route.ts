import { NextResponse } from 'next/server'
import { getStorefrontCatalog } from '@/lib/catalog/server'

export async function GET() {
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
