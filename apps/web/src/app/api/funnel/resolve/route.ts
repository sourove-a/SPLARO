import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const host = request.nextUrl.searchParams.get('host') ?? ''
  const slug = request.nextUrl.searchParams.get('slug') ?? request.nextUrl.searchParams.get('drop') ?? ''
  const base = getServerApiBaseUrl().replace(/\/+$/, '')

  try {
    const url = new URL(`${base}/funnel/resolve`)
    url.searchParams.set('host', host)
    if (slug) url.searchParams.set('slug', slug)

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json(
      { message: 'Unable to connect to funnel backend', error: String(err) },
      { status: 502 },
    )
  }
}
