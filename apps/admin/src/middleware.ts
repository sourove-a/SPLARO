import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/auth/session'
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const origin = getAdminRequestOrigin(request)

  if (pathname.startsWith('/dashboard')) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
    const session = token ? await verifyAdminSessionToken(token) : null

    if (!session) {
      const loginUrl = new URL('/login', origin)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
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
      return NextResponse.redirect(new URL('/dashboard', origin))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/login'],
}
