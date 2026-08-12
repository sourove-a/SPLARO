import { NextResponse } from 'next/server'
import { apiResetPassword, attachSessionCookie } from '@/lib/server/api-auth'
import { getTrustedClientIp } from '@/lib/server/client-ip'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

interface ResetPasswordBody {
  token?: string
  password?: string
}

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'auth-reset-password'), 5, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: limit.retryAfter },
      { status: 429 },
    )
  }

  let body: ResetPasswordBody
  try {
    body = (await request.json()) as ResetPasswordBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const token = body.token?.trim()
  const password = body.password

  if (!token || !password) {
    return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const result = await apiResetPassword(token, password, getTrustedClientIp(request))
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const response = NextResponse.json({
    success: true,
    message: result.message,
    user: result.user,
  })
  return attachSessionCookie(response, result.sessionToken)
}
