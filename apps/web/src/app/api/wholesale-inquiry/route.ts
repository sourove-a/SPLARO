import { NextResponse } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

const STORE_ID = process.env['NEXT_PUBLIC_STORE_ID'] ?? 'splaro'

interface WholesaleBody {
  fullName?: string
  companyName?: string
  industry?: string
  country?: string
  phone?: string
  email?: string
  productInterest?: string
  monthlyQuantity?: string
  monthlyUnits?: number
  tierSlug?: string
  targetLaunch?: string
  message?: string
  sourcePath?: string
  imageUrls?: string[]
}

export async function POST(request: Request) {
  // Public form — cap it here as well as in the API so a script cannot lean on
  // this route to hammer the upstream.
  const limit = await rateLimit(getClientKey(request, 'wholesale-inquiry'), 5, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests — please try again in a minute.', retryAfter: limit.retryAfter },
      { status: 429 },
    )
  }

  let body: WholesaleBody
  try {
    body = (await request.json()) as WholesaleBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const required = ['fullName', 'industry', 'country', 'phone'] as const
  for (const field of required) {
    if (!body[field]?.trim()) {
      return NextResponse.json({ error: 'Name, industry, country and phone are required.' }, { status: 400 })
    }
  }

  const imageUrls = (body.imageUrls ?? [])
    .filter((url): url is string => typeof url === 'string')
    .map((url) => url.trim())
    .filter((url) => /^\/uploads\/wholesale\/[a-zA-Z0-9._-]+\.(jpe?g|png|webp)$/i.test(url))
    .slice(0, 4)

  try {
    const res = await fetch(
      `${getServerApiBaseUrl()}/storefront/wholesale-inquiry?storeId=${encodeURIComponent(STORE_ID)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, imageUrls }),
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      },
    )

    const data = (await res.json().catch(() => ({}))) as {
      message?: string
      error?: string
      duplicate?: boolean
      referenceCode?: string | null
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: data.message ?? data.error ?? 'Could not send your enquiry. Please try again.' },
        { status: res.status === 400 ? 400 : 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      message: data.message,
      duplicate: Boolean(data.duplicate),
      // Passed straight through so the buyer sees a handle they can quote back.
      referenceCode: data.referenceCode ?? null,
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return NextResponse.json({ error: 'Request timed out — please try again.' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Could not reach SPLARO. Please try again.' }, { status: 503 })
  }
}
