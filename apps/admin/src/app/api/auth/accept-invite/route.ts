import { NextResponse } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'
import { ADMIN_SESSION_COOKIE, createAdminSessionToken, sessionCookieOptions } from '@/lib/auth/session'

export async function POST(request: Request) {
  const body = (await request.json()) as { token?: string; password?: string; firstName?: string }
  const token = body.token?.trim()
  const password = body.password ?? ''
  const firstName = body.firstName?.trim()

  if (!token || password.length < 8) {
    return NextResponse.json(
      { error: 'Valid invite token and password (min 8 characters) required' },
      { status: 400 },
    )
  }

  const base = getServerApiBaseUrl()

  try {
    const res = await fetch(`${base}/admin/auth/accept-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        password,
        ...(firstName ? { firstName } : {}),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
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
        { error: data.message ?? data.error ?? 'Invalid or expired invite' },
        { status: res.status === 403 ? 403 : 400 },
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
      return NextResponse.json({ error: 'Request timed out — please try again.' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Unable to reach API.' }, { status: 503 })
  }
}
