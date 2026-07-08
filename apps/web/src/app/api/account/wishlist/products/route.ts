import { NextResponse } from 'next/server'
import { storefrontToCardData } from '@/lib/catalog/product-card-map'
import { fetchProductsByIds } from '@/lib/catalog/live'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ids = (searchParams.get('ids') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  if (!ids.length) {
    return NextResponse.json({ products: [] })
  }

  const raw = await fetchProductsByIds(ids)
  const products = raw.map(storefrontToCardData)
  return NextResponse.json({ products })
}
