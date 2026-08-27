import { NextResponse } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'
import { getSessionToken, sessionHeaders } from '@/lib/server/api-auth'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

function clientAddress(request: Request): string | undefined {
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { visitorId?: string }
    const visitorId = body.visitorId?.trim()
    if (!visitorId || visitorId.length > 128) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const base = getServerApiBaseUrl()
    const forwardedFor = clientAddress(request)
    // Forward the session so the API can resolve who is browsing and light up
    // their row in the admin customer list. Read from the cookie here rather
    // than sent by the page — the heartbeat route is public, and an identity a
    // browser could name is an identity anyone could claim.
    const sessionToken = await getSessionToken()
    const res = await fetch(
      `${base}/storefront/presence/heartbeat?storeId=${encodeURIComponent(STORE_ID)}`,
      {
        method: 'POST',
        headers: sessionHeaders(sessionToken, forwardedFor ?? null),
        body: JSON.stringify({ visitorId }),
        cache: 'no-store',
      },
    )

    if (!res.ok) {
      const retryAfter = res.headers.get('retry-after')
      return NextResponse.json(
        { ok: false },
        retryAfter
          ? { status: res.status, headers: { 'Retry-After': retryAfter } }
          : { status: res.status },
      )
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 })
  }
}
