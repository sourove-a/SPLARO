import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/auth/session'
import { getAdminRequestOrigin } from '@/lib/auth/request-origin'

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
