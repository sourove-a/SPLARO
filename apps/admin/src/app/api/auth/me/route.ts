import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/auth/session'
import { formatAdminDisplayName } from '@/lib/auth/role-label'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  return NextResponse.json({
    user: {
      id: session.userId,
      email: session.email,
      name: formatAdminDisplayName(session.name, session.email),
      role: session.role,
      storeId: session.storeId,
      permissions: session.permissions ?? [],
    },
    apiToken: token,
  })
}
