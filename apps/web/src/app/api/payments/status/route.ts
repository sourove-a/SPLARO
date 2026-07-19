import { NextResponse } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'
import { fetchWithTimeout } from '@/lib/server/build-safe-fetch'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

export async function GET(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'payment-status'), 30, 60_000)
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const searchParams = new URL(request.url).searchParams
  const invoiceNumber = searchParams.get('invoiceNumber')?.trim()
  const key = searchParams.get('key')?.trim()
  if (!invoiceNumber || !key) {
    return NextResponse.json({ error: 'invoiceNumber and key are required' }, { status: 400 })
  }

  const response = await fetchWithTimeout(
    `${getServerApiBaseUrl()}/payments/status?invoiceNumber=${encodeURIComponent(invoiceNumber)}&key=${encodeURIComponent(key)}`,
    { cache: 'no-store' },
  )
  if (!response) {
    return NextResponse.json({ error: 'Payment verification timed out' }, { status: 504 })
  }

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!response.ok || !payload) {
    return NextResponse.json(
      { error: typeof payload?.message === 'string' ? payload.message : 'Payment state unavailable' },
      { status: response.status },
    )
  }
  return NextResponse.json(payload)
}
