import { NextResponse } from 'next/server'
import { toProductCard } from '@/lib/catalog/index'
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
  const products = raw.map(toProductCard)
  return NextResponse.json({ products })
}
