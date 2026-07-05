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
    const res = await fetch(`${base}/admin/auth/request-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, storeId }),
      cache: 'no-store',
    })

    const data = (await res.json()) as { message?: string; error?: string; email?: string; tokenSent?: boolean }
    if (!res.ok) {
      return NextResponse.json(
        { error: data.message ?? data.error ?? 'No admin account found for this email' },
        { status: res.status },
      )
    }

    return NextResponse.json({ ok: true, email: data.email ?? email, tokenSent: data.tokenSent ?? true })
  } catch {
    return NextResponse.json({ error: 'Unable to reach API. Is pnpm dev:stack running?' }, { status: 503 })
  }
}
