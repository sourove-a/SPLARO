import { NextResponse } from 'next/server'
import {
  apiAuthSignup,
  attachSessionCookie,
} from '@/lib/server/api-auth'
import { getBdPhoneError, normalizeBdPhone } from '@/lib/checkout/phone'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

interface SignupBody {
  name?: string
  email?: string
  phone?: string
  password?: string
}

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'auth-signup'))
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: limit.retryAfter },
      { status: 429 },
    )
  }

  let body: SignupBody
  try {
    body = (await request.json()) as SignupBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = body.name?.trim()
  const email = body.email?.trim().toLowerCase()
  const phoneRaw = body.phone?.trim() ?? ''
  const phoneError = getBdPhoneError(phoneRaw)
  const phone = phoneError ? '' : normalizeBdPhone(phoneRaw)
  const password = body.password

  if (!name || !email || !phone || !password) {
    return NextResponse.json(
      { error: phoneError || 'Name, email, phone, and password are required' },
      { status: 400 },
    )
  }

  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters and include a letter and a number' },
      { status: 400 },
    )
  }

  const result = await apiAuthSignup({ name, email, phone, password })
  if ('error' in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status && result.status >= 400 ? result.status : 400 },
    )
  }

  const response = NextResponse.json({ user: result.user }, { status: 201 })
  return attachSessionCookie(response, result.sessionToken)
}
