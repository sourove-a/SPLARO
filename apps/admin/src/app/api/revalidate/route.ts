import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET
  const webUrl = (
    process.env.WEB_URL ??
    process.env.NEXT_PUBLIC_WEB_URL ??
    'http://127.0.0.1:3000'
  ).replace(/\/$/, '')

  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'REVALIDATE_SECRET not configured on admin server' },
      { status: 503 },
    )
  }

  let tags: string[] | undefined
  try {
    const body = (await request.json()) as { tags?: string[] }
    tags = body.tags
  } catch {
    /* default tags */
  }

  try {
    const res = await fetch(`${webUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': secret,
      },
      body: JSON.stringify({
        tags: tags ?? ['storefront-products', 'storefront-settings'],
      }),
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })

    const payload = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
      revalidated?: string[]
    }

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: payload.error ?? `Web revalidate failed (${res.status})` },
        { status: res.status },
      )
    }

    return NextResponse.json(payload)
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Storefront revalidate unreachable',
      },
      { status: 502 },
    )
  }
}
