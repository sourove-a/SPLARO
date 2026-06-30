import { NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/auth/admin-auth'
import { ADMIN_SESSION_COOKIE, createAdminSessionToken, sessionCookieOptions } from '@/lib/auth/session'

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string }
  const email = body.email?.trim()
  const password = body.password ?? ''

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const user = await authenticateAdmin(email, password)
  if (!user) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const token = await createAdminSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    ...(user.storeId ? { storeId: user.storeId } : {}),
  })

  const response = NextResponse.json({
    ok: true,
    apiToken: token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      storeId: user.storeId,
    },
  })

  response.cookies.set(ADMIN_SESSION_COOKIE, token, sessionCookieOptions())
  return response
}
