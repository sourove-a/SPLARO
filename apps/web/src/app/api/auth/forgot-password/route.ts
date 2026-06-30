import { NextResponse } from 'next/server'
import { createResetToken } from '@/lib/server/auth'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

interface ForgotPasswordBody {
  email?: string
}

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'auth-forgot-password'))
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

  const email = body.email?.trim()
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const token = await createResetToken(email)

  return NextResponse.json({
    success: true,
    message: 'If that email exists, a reset link has been sent',
    ...(process.env.NODE_ENV !== 'production' && token
      ? { resetToken: token.token }
      : {}),
  })
}
