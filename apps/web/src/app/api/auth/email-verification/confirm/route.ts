import { NextResponse } from 'next/server'
import { apiConfirmEmailVerification } from '@/lib/server/api-auth'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'email-verification-confirm'), 12, 60_000)
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 })
  }

  const body = (await request.json().catch(() => ({}))) as { token?: string }
  const token = body.token?.trim()
  if (!token) {
    return NextResponse.json({ error: 'Verification token required' }, { status: 400 })
  }

  const result = await apiConfirmEmailVerification(token)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json(result)
}
