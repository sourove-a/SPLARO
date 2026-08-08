import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  ADMIN_SESSION_COOKIE,
  sessionCookieOptions,
  verifyAdminSessionToken,
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
      return NextResponse.next()
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
      return NextResponse.redirect(new URL('/dashboard/access-denied', origin))
    }
  }

  if (pathname === '/login') {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
    if (token && (await verifyAdminSessionToken(token))) {
      const live = await probeLiveAdminSession(token)
      if (live === 'rejected') {
        const res = NextResponse.next()
        res.cookies.set(ADMIN_SESSION_COOKIE, '', { ...sessionCookieOptions(0), maxAge: 0 })
        return res
      }
      return NextResponse.redirect(new URL('/dashboard', origin))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/login'],
}

// Auth pages /forgot-password, /reset-password, /invite/accept stay public (no matcher).
