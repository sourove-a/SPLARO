import { NextResponse } from 'next/server'
import { getApiBaseUrl } from '@splaro/config'

export const dynamic = 'force-dynamic'

/** Lightweight same-origin ping for AdminApiStatus (avoids browser → :4000 noise). */
export async function GET() {
  const base = getApiBaseUrl()
  const start = Date.now()
  try {
    const res = await fetch(`${base}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3500),
    })
    return NextResponse.json({
      online: res.ok,
      latencyMs: Date.now() - start,
    })
  } catch {
    return NextResponse.json({ online: false, latencyMs: null })
  }
}
