import { NextResponse } from 'next/server'
import { apiAuthGoogle, attachSessionCookie } from '@/lib/server/api-auth'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'auth-google'))
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: limit.retryAfter },
      { status: 429 },
    )
  }

  let body: { credential?: string }
  try {
    body = (await request.json()) as { credential?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const credential = body.credential?.trim()
  if (!credential) {
    return NextResponse.json({ error: 'Google credential is required' }, { status: 400 })
  }

  const result = await apiAuthGoogle(credential)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 401 })
  }

  const response = NextResponse.json(
    { user: result.user, needsPhone: result.needsPhone },
    { status: 200 },
  )
  return attachSessionCookie(response, result.sessionToken)
}
