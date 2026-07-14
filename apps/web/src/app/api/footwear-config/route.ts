import { NextResponse } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'

export const dynamic = 'force-dynamic'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

async function proxyToApi(method: 'GET' | 'PUT', body?: unknown) {
  const base = getServerApiBaseUrl()
  const init: RequestInit = {
    method,
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  }
  if (method === 'PUT') {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  return fetch(`${base}/storefront/footwear?storeId=${encodeURIComponent(STORE_ID)}`, init)
}

/** Storefront footwear config — reads from Nest API (database-backed). */
export async function GET() {
  try {
    const res = await proxyToApi('GET')
    if (!res.ok) {
      return NextResponse.json({ error: 'Footwear config unavailable' }, { status: res.status })
    }
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: 'API unreachable' }, { status: 502 })
  }
}

export async function PUT(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Direct footwear file writes disabled — use admin panel (saves to database).' },
      { status: 403 },
    )
  }
  const body = await req.json()
  try {
    const res = await proxyToApi('PUT', body)
    const payload = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      return NextResponse.json({ error: payload.error ?? 'Save failed' }, { status: res.status })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'API unreachable' }, { status: 502 })
  }
}
