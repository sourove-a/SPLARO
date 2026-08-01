import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/auth/session'
import { formatAdminDisplayName } from '@/lib/auth/role-label'

function clientIpFromHeaders(h: Headers): string {
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  const real = h.get('x-real-ip')?.trim()
  if (real) return real
  const cf = h.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  return 'unknown'
}

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

  const h = await headers()
  const clientIp = clientIpFromHeaders(h)

  return NextResponse.json({
    user: {
      id: session.userId,
      email: session.email,
      name: formatAdminDisplayName(session.name, session.email),
      role: session.role,
      storeId: session.storeId,
      permissions: session.permissions ?? [],
    },
    clientIp,
    apiToken: token,
  })
}
