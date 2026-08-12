import { NextResponse } from 'next/server'
import { apiForgotPassword } from '@/lib/server/api-auth'
import { getTrustedClientIp } from '@/lib/server/client-ip'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

interface ForgotPasswordBody {
  /** Email or BD phone number — the reset link always goes to the account's email. */
  email?: string
}

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'auth-forgot-password'), 3, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: limit.retryAfter },
      { status: 429 },
    )
  }

  let body: ForgotPasswordBody
  try {
    body = (await request.json()) as ForgotPasswordBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const identifier = body.email?.trim()
  if (!identifier) {
    return NextResponse.json({ error: 'Email or phone number is required' }, { status: 400 })
  }

  const result = await apiForgotPassword(identifier, getTrustedClientIp(request))
  if ('error' in result) {
    const status =
      result.status && result.status >= 400 && result.status < 500 ? result.status : 503
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({
    success: true,
    message: result.message,
    ...(result.devToken ? { resetToken: result.devToken } : {}),
  })
}
