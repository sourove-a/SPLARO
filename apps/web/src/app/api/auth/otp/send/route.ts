import { NextResponse } from 'next/server'
import { apiSendOtp } from '@/lib/server/api-auth'
import { getTrustedClientIp } from '@/lib/server/client-ip'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'otp-send'), 5, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: limit.retryAfter },
      { status: 429 },
    )
  }

  let body: { phone?: string }
  try {
    body = (await request.json()) as { phone?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const phone = body.phone?.trim()
  if (!phone) {
    return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
  }

  const result = await apiSendOtp(phone, getTrustedClientIp(request))
  if (!result.sent) {
    return NextResponse.json({ error: result.error ?? 'Could not send code' }, { status: 400 })
  }

  return NextResponse.json({
    sent: true,
    ...(result.devCode ? { devCode: result.devCode } : {}),
  })
}
