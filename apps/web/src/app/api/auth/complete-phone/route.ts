import { NextResponse } from 'next/server'
import { apiCompletePhone, getSessionToken } from '@/lib/server/api-auth'
import { getTrustedClientIp } from '@/lib/server/client-ip'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'auth-complete-phone'), 8, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: limit.retryAfter },
      { status: 429 },
    )
  }

  const sessionToken = await getSessionToken()
  if (!sessionToken) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  let body: { phone?: string; code?: string }
  try {
    body = (await request.json()) as { phone?: string; code?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const phone = body.phone?.trim()
  if (!phone) {
    return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
  }

  const result = await apiCompletePhone(
    sessionToken,
    {
      phone,
      ...(body.code?.trim() ? { code: body.code.trim() } : {}),
    },
    getTrustedClientIp(request),
  )

  if ('error' in result) {
    return NextResponse.json(
      { error: result.error, ...(result.code ? { code: result.code } : {}) },
      { status: 400 },
    )
  }

  return NextResponse.json({ user: result.user }, { status: 200 })
}
