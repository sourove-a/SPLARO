import { NextResponse } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string }
  const email = body.email?.trim()
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const storeId = process.env['NEXT_PUBLIC_STORE_ID'] ?? 'splaro'
  const base = getServerApiBaseUrl()

  try {
    const res = await fetch(`${base}/admin/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, storeId }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })

    const data = (await res.json()) as { message?: string; error?: string; ok?: boolean }
    if (!res.ok) {
      return NextResponse.json(
        { error: data.message ?? data.error ?? 'Could not process reset request' },
        { status: res.status },
      )
    }

    return NextResponse.json({
      ok: true,
      message: data.message ?? 'If that email has admin access, a reset link was sent.',
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return NextResponse.json({ error: 'Request timed out — please try again.' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Unable to reach API.' }, { status: 503 })
  }
}
