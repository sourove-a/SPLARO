import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const base = getServerApiBaseUrl().replace(/\/+$/, '')

  try {
    const body = await request.json()
    const res = await fetch(`${base}/funnel/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json(
      { message: 'Order submission failed upstream', error: String(err) },
      { status: 502 },
    )
  }
}
