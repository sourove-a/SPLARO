import { NextResponse } from 'next/server'
import { apiSendEmailVerification, getSessionToken } from '@/lib/server/api-auth'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'email-verification-send'), 4, 60_000)
  if (!limit.ok) {
    return NextResponse.json({ error: 'Please wait before requesting another code' }, { status: 429 })
  }
  const sessionToken = await getSessionToken()
  if (!sessionToken) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const result = await apiSendEmailVerification(sessionToken)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result)
}
