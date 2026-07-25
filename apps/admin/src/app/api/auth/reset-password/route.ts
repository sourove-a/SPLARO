import { NextResponse } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'

export async function POST(request: Request) {
  const body = (await request.json()) as { token?: string; password?: string }
  const token = body.token?.trim()
  const password = body.password ?? ''

  if (!token || password.length < 8) {
    return NextResponse.json(
      { error: 'Valid reset token and password (min 8 characters) required' },
      { status: 400 },
    )
  }

  const base = getServerApiBaseUrl()

  try {
    const res = await fetch(`${base}/admin/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })

    const data = (await res.json()) as { message?: string; error?: string; ok?: boolean }
    if (!res.ok) {
      return NextResponse.json(
        { error: data.message ?? data.error ?? 'Invalid or expired reset link' },
        { status: res.status === 403 ? 403 : 400 },
      )
    }

    return NextResponse.json({
      ok: true,
      message: data.message ?? 'Password updated — sign in with your email and password.',
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return NextResponse.json({ error: 'Request timed out — please try again.' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Unable to reach API.' }, { status: 503 })
  }
}
