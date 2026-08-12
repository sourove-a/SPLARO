import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_MS,
  createAdminSessionToken,
  sessionCookieOptions,
  verifyAdminSessionToken,
  type AdminSessionPayload,
} from '@/lib/auth/session'
import { probeLiveAdminSession } from '@/lib/auth/live-session'
import { getAdminRequestOrigin } from '@/lib/auth/request-origin'
import {
  canAccessNavRoute,
  resolveNavPermissionModule,
} from '@/lib/navigation/admin-nav-permissions'
import { hasPermission, type PermissionAction } from '@/lib/auth/permissions'
import { resolveNavRoute } from '@/lib/navigation/admin-nav'

function dashboardPermissionAction(pathname: string): PermissionAction {
  const slug = pathname.replace(/^\/dashboard\/?/, '').split('/').filter(Boolean)
  const resolved = resolveNavRoute(slug)
  if (resolved?.action === 'create') return 'create'
  if (resolved?.action === 'edit') return 'edit'
  return 'view'
}

function clearSessionRedirect(url: URL) {
  const res = NextResponse.redirect(url)
  res.cookies.set(ADMIN_SESSION_COOKIE, '', { ...sessionCookieOptions(0), maxAge: 0 })
  return res
}

async function attachSlidingRefresh(
  res: NextResponse,
  session: AdminSessionPayload,
  live: 'ok' | 'rejected' | 'unreachable',
): Promise<NextResponse> {
  // Only refresh when API confirmed the account is still live — never on blips.
  if (live !== 'ok') return res
  if (session.exp - Date.now() >= ADMIN_SESSION_TTL_MS / 2) return res

  const refreshed = await createAdminSessionToken({
    userId: session.userId,
    email: session.email,
    name: session.name,
    role: session.role,
    ...(session.storeId ? { storeId: session.storeId } : {}),
    permissions: session.permissions ?? [],
  })
  res.cookies.set(ADMIN_SESSION_COOKIE, refreshed, sessionCookieOptions())
  return res
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const origin = getAdminRequestOrigin(request)

  if (pathname.startsWith('/dashboard')) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
    const session = token ? await verifyAdminSessionToken(token) : null

    if (!session || !token) {
      const loginUrl = new URL('/login', origin)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const live = await probeLiveAdminSession(token)
    if (live === 'rejected') {
      const loginUrl = new URL('/login', origin)
      loginUrl.searchParams.set('next', pathname)
      return clearSessionRedirect(loginUrl)
    }

    if (pathname === '/dashboard/access-denied') {
      return attachSlidingRefresh(NextResponse.next(), session, live)
    }

    const moduleHref =
      resolveNavRoute(pathname.replace(/^\/dashboard\/?/, '').split('/').filter(Boolean))?.moduleHref ??
      '/dashboard'
    const action = dashboardPermissionAction(pathname)
    const permModule = resolveNavPermissionModule(moduleHref)

    const allowed =
      pathname === '/dashboard'
        ? canAccessNavRoute('/dashboard', session, 'view')
        : hasPermission(session.role, session.permissions, permModule, action)

    if (!allowed) {
      return attachSlidingRefresh(
        NextResponse.redirect(new URL('/dashboard/access-denied', origin)),
        session,
        live,
      )
    }

    return attachSlidingRefresh(NextResponse.next(), session, live)
  }

  if (pathname === '/login') {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
    const session = token ? await verifyAdminSessionToken(token) : null
    if (token && session) {
      const live = await probeLiveAdminSession(token)
      if (live === 'rejected') {
        const res = NextResponse.next()
        res.cookies.set(ADMIN_SESSION_COOKIE, '', { ...sessionCookieOptions(0), maxAge: 0 })
        return res
      }
      return attachSlidingRefresh(
        NextResponse.redirect(new URL('/dashboard', origin)),
        session,
        live,
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/login'],
}

// Auth pages /forgot-password, /reset-password, /invite/accept stay public (no matcher).
