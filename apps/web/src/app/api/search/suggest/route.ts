import { NextResponse } from 'next/server'
import { apiSearchSuggest } from '@/lib/server/api-auth'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 8), 1), 12)

  if (q.length < 2) {
    return NextResponse.json({ products: [], popularTerms: [], query: q })
  }

  try {
    const result = await apiSearchSuggest(q, limit)
    return NextResponse.json({ ...result, query: q, source: 'api' })
  } catch {
    return NextResponse.json(
      { products: [], popularTerms: [], query: q, error: 'Suggest offline' },
      { status: 503 },
    )
  }
}
