import { getServerApiBaseUrl } from '@splaro/config'
import { NextResponse } from 'next/server'
import { fetchWithTimeout } from '@/lib/server/build-safe-fetch'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'newsletter-subscribe'))
  if (!limit.ok) {
    return NextResponse.json(
      { message: 'Too many requests — please wait and try again.' },
      { status: 429 },
    )
  }

  let email = ''
  try {
    const body = (await request.json()) as { email?: string }
    email = body.email?.trim() ?? ''
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  if (!email || !email.includes('@')) {
    return NextResponse.json({ message: 'A valid email is required' }, { status: 400 })
  }

  const res = await fetchWithTimeout(
    `${getServerApiBaseUrl()}/storefront/newsletter/subscribe?storeId=${encodeURIComponent(STORE_ID)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      cache: 'no-store',
    },
  )

  if (!res) {
    return NextResponse.json(
      { message: 'Newsletter service is temporarily unavailable.' },
      { status: 503 },
    )
  }

  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] }
  if (!res.ok) {
    const message = Array.isArray(data.message) ? data.message[0] : data.message
    return NextResponse.json(
      { message: message ?? 'Could not subscribe right now.' },
      { status: res.status },
    )
  }

  return NextResponse.json(data)
}
