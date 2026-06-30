import { NextResponse } from 'next/server'
import { apiVerifyOtp, attachPhoneAccessCookie } from '@/lib/server/api-auth'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'otp-verify'))
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: limit.retryAfter },
      { status: 429 },
    )
  }

  let body: { phone?: string; code?: string }
  try {
    body = (await request.json()) as { phone?: string; code?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const phone = body.phone?.trim()
  const code = body.code?.trim()
  if (!phone || !code) {
    return NextResponse.json({ error: 'Phone and verification code are required' }, { status: 400 })
  }

  const result = await apiVerifyOtp(phone, code)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 401 })
  }

  const response = NextResponse.json({ verified: true })
  return attachPhoneAccessCookie(response, result.phoneAccessToken, result.expiresAt)
}
