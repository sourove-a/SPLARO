import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerApiBaseUrl } from '@splaro/config'
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  sessionCookieOptions,
  verifyAdminSessionToken,
} from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  if (!token) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const session = await verifyAdminSessionToken(token)
  if (!session) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as { name?: string } | null
  const name = body?.name?.trim() ?? ''
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const base = getServerApiBaseUrl().replace(/\/+$/, '')
  let upstream: Response
  try {
    upstream = await fetch(`${base}/admin/auth/profile`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    return NextResponse.json({ error: 'Unable to connect. Please try again.' }, { status: 503 })
  }

  const data = (await upstream.json().catch(() => ({}))) as {
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

  if (!upstream.ok || !data.user?.id) {
    return NextResponse.json(
      { error: data.message ?? data.error ?? 'Could not update name' },
      { status: upstream.status >= 400 ? upstream.status : 400 },
    )
  }

  const sessionToken = await createAdminSessionToken({
    userId: data.user.id,
    email: data.user.email,
    name: data.user.name,
    role: data.user.role,
    ...(data.user.storeId ? { storeId: data.user.storeId } : {}),
    permissions: data.user.permissions ?? session.permissions ?? [],
  })

  const response = NextResponse.json({
    ok: true,
    user: data.user,
    apiToken: sessionToken,
  })
  response.cookies.set(ADMIN_SESSION_COOKIE, sessionToken, sessionCookieOptions())
  return response
}
