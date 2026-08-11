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
    const res = await fetch(`${base}/admin/auth/login-method`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, storeId }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })

    const data = (await res.json()) as {
      method?: 'telegram' | 'password'
      email?: string
      message?: string
      error?: string
    }

    if (!res.ok || (data.method !== 'telegram' && data.method !== 'password')) {
      return NextResponse.json(
        { error: data.message ?? data.error ?? 'Could not verify this email. Try again.' },
        { status: res.status === 401 || res.status === 403 ? res.status : 400 },
      )
    }

    return NextResponse.json({ ok: true, method: data.method, email: data.email ?? email })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return NextResponse.json({ error: 'Request timed out — please try again.' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Unable to reach API. Is pnpm dev:stack running?' }, { status: 503 })
  }
}
