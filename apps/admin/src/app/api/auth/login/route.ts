import { NextResponse } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'
import { ADMIN_SESSION_COOKIE, createAdminSessionToken, sessionCookieOptions } from '@/lib/auth/session'

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; token?: string; password?: string }
  const email = body.email?.trim()
  const token = body.token?.trim()
  const password = body.password ?? ''

  if (!email || (!token && !password)) {
    return NextResponse.json({ error: 'Email and a Telegram token or password required' }, { status: 400 })
  }

  const storeId = process.env['NEXT_PUBLIC_STORE_ID'] ?? 'splaro'
  const base = getServerApiBaseUrl()

  try {
    const res = await fetch(`${base}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(token ? { email, token, storeId } : { email, password, storeId }),
      cache: 'no-store',
    })

    const data = (await res.json()) as {
      error?: string
      message?: string
      user?: { id: string; email: string; name: string; role: string; storeId?: string }
    }

    if (!res.ok || !data.user?.id) {
      return NextResponse.json(
        { error: data.message ?? data.error ?? 'Invalid or expired token' },
        { status: res.status === 401 ? 401 : 400 },
      )
    }

    const sessionToken = await createAdminSessionToken({
      userId: data.user.id,
      email: data.user.email,
      name: data.user.name,
      role: data.user.role,
      ...(data.user.storeId ? { storeId: data.user.storeId } : {}),
    })

    const response = NextResponse.json({
      ok: true,
      apiToken: sessionToken,
      user: data.user,
    })

    response.cookies.set(ADMIN_SESSION_COOKIE, sessionToken, sessionCookieOptions())
    return response
  } catch {
    return NextResponse.json({ error: 'Unable to connect. Please try again.' }, { status: 503 })
  }
}
