import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { resolveAccessoryRedirect } from '@/lib/storefront/accessories-slugs'
import {
  getStorefrontRedirects,
  matchRedirect,
  redirectStatusCode,
} from '@/lib/server/url-redirects'

const MAINTENANCE_ENABLED = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'

function redirectToShortCollection(request: NextRequest, slug: string) {
  const url = request.nextUrl.clone()
  url.pathname = `/c/${slug}`
  return NextResponse.redirect(url)
}

function redirectToTarget(request: NextRequest, target: string, status = 307) {
  if (/^https?:\/\//i.test(target)) {
    return NextResponse.redirect(target, status)
  }
  const url = request.nextUrl.clone()
  const [path, query] = target.split('?')
  url.pathname = path ?? target
  url.search = query ? `?${query}` : ''
  return NextResponse.redirect(url, status)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const managedRedirects = await getStorefrontRedirects()
  const matched = matchRedirect(pathname, managedRedirects)
  if (matched) {
    return redirectToTarget(request, matched.toPath, redirectStatusCode(matched.type))
  }

  if (pathname.startsWith('/c/')) {
    const slug = pathname.slice(3).replace(/\/$/, '')
    if (slug) {
      const accessoryTarget = resolveAccessoryRedirect(slug)
      if (accessoryTarget) {
        return redirectToTarget(request, accessoryTarget)
      }
    }
  }

  if (pathname.startsWith('/collections/')) {
    const slug = pathname.slice('/collections/'.length).replace(/\/$/, '')
    if (slug) {
      return redirectToShortCollection(request, slug)
    }
  }

  if (!MAINTENANCE_ENABLED) return NextResponse.next()

  if (
    pathname.startsWith('/maintenance') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const url = request.nextUrl.clone()
  url.pathname = '/maintenance'
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
