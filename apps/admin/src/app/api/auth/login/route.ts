import { NextResponse } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'
import { ADMIN_SESSION_COOKIE, createAdminSessionToken, sessionCookieOptions } from '@/lib/auth/session'

type LoginBody = { email?: string; token?: string; password?: string }

export async function POST(request: Request) {
  const body = (await request.json()) as LoginBody
  const email = body.email?.trim()
  const token = body.token?.trim()
  const password = body.password ?? ''

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }
  if (!token && !password) {
    return NextResponse.json({ error: 'Login token or password required' }, { status: 400 })
  }
  if (token && password) {
    return NextResponse.json({ error: 'Send either token or password, not both' }, { status: 400 })
  }

  const storeId = process.env['NEXT_PUBLIC_STORE_ID'] ?? 'splaro'
  const base = getServerApiBaseUrl()

  try {
    const res = await fetch(`${base}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        token ? { email, token, storeId } : { email, password, storeId },
      ),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
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
        { error: data.message ?? data.error ?? 'Invalid credentials' },
        { status: res.status === 401 || res.status === 403 ? res.status : 400 },
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
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return NextResponse.json(
        { error: 'Login timed out — please try again.' },
        { status: 504 },
      )
    }
    return NextResponse.json({ error: 'Unable to connect. Please try again.' }, { status: 503 })
  }
}
