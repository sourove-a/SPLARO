import { NextResponse } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'
import { ADMIN_SESSION_COOKIE, createAdminSessionToken, sessionCookieOptions } from '@/lib/auth/session'

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; token?: string }
  const email = body.email?.trim()
  const token = body.token?.trim()

  if (!email || !token) {
    return NextResponse.json({ error: 'Email and Telegram token required' }, { status: 400 })
  }

  const storeId = process.env['NEXT_PUBLIC_STORE_ID'] ?? 'splaro'
  const base = getServerApiBaseUrl()

  try {
    const res = await fetch(`${base}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token, storeId }),
      cache: 'no-store',
    })

    const data = (await res.json()) as {
      error?: string
      message?: string
      user?: {
        id: string
        email: string
        name: string
        role: string
        storeId?: string
        permissions?: string[]
      }
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
      permissions: data.user.permissions ?? [],
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
