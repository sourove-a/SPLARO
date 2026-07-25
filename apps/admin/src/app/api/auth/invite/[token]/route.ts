import { NextResponse } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token: raw } = await context.params
  const token = decodeURIComponent(raw ?? '').trim()
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Invalid invite link' }, { status: 400 })
  }

  const base = getServerApiBaseUrl()

  try {
    const res = await fetch(`${base}/admin/auth/invite/${encodeURIComponent(token)}`, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })

    const data = (await res.json()) as {
      emailMasked?: string
      role?: string
      firstName?: string
      expiresAt?: string
      message?: string
      error?: string
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: data.message ?? data.error ?? 'Invalid or expired invite' },
        { status: 400 },
      )
    }

    return NextResponse.json({
      ok: true,
      emailMasked: data.emailMasked,
      role: data.role,
      firstName: data.firstName,
      expiresAt: data.expiresAt,
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return NextResponse.json({ error: 'Request timed out — please try again.' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Unable to reach API.' }, { status: 503 })
  }
}
