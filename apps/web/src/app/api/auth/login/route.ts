import { NextResponse } from 'next/server'
import {
  apiAuthLogin,
  attachSessionCookie,
} from '@/lib/server/api-auth'
import { getTrustedClientIp } from '@/lib/server/client-ip'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

interface LoginBody {
  email?: string
  password?: string
}

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'auth-login'), 10, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: limit.retryAfter },
      { status: 429 },
    )
  }

  let body: LoginBody
  try {
    body = (await request.json()) as LoginBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const identifier = body.email?.trim()
  const password = body.password

  if (!identifier || !password) {
    return NextResponse.json({ error: 'Email or phone and password are required' }, { status: 400 })
  }

  const result = await apiAuthLogin(
    { email: identifier, password },
    getTrustedClientIp(request),
  )
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 401 })
  }

  const response = NextResponse.json({ user: result.user })
  return attachSessionCookie(response, result.sessionToken)
}
