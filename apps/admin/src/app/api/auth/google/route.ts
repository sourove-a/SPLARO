import { NextResponse } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  sessionCookieOptions,
} from '@/lib/auth/session'

type GoogleLoginBody = { credential?: string }

/**
 * Exchange a Google ID token for an admin session cookie.
 *
 * Mirrors /api/auth/login: the API decides whether the Google account belongs
 * to an active admin, and this route only mints the cookie once it says yes.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as GoogleLoginBody
  const credential = body.credential?.trim()

  if (!credential) {
    return NextResponse.json({ error: 'Google credential required' }, { status: 400 })
  }

  const storeId = process.env['NEXT_PUBLIC_STORE_ID'] ?? 'splaro'
  const base = getServerApiBaseUrl()

  try {
    const res = await fetch(`${base}/admin/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential, storeId }),
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
        { error: data.message ?? data.error ?? 'This Google account cannot access the admin panel' },
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
      return NextResponse.json({ error: 'Sign-in timed out — please try again.' }, { status: 504 })
    }
    // The generic text hides a config problem from the operator, so log the
    // real cause where support can find it.
    console.error('[admin-auth] Google sign-in failed:', error)
    return NextResponse.json({ error: 'Unable to connect. Please try again.' }, { status: 503 })
  }
}
