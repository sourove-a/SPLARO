import { NextResponse } from 'next/server'
import { apiVerifyEmail, getSessionToken } from '@/lib/server/api-auth'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'email-verification-check'), 8, 60_000)
  if (!limit.ok) return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 })
  const sessionToken = await getSessionToken()
  if (!sessionToken) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { code?: string }
  const result = await apiVerifyEmail(sessionToken, body.code ?? '')
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result)
}
