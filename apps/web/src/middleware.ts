import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { resolveAccessoryRedirect } from '@/lib/storefront/accessories-slugs'
import {
  getStorefrontRedirects,
  matchRedirect,
  redirectStatusCode,
} from '@/lib/server/url-redirects'
import { isAllowedExternalRedirect } from '@/lib/server/redirect-allowlist'
import { productSlugExists } from '@/lib/server/product-exists'

const MAINTENANCE_ENABLED = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'

/**
 * Absolute redirect target that never leaks `https://localhost:3000` behind nginx.
 * Prefer public SITE_URL / x-forwarded-* when NextURL host is loopback.
 */
function publicRedirectUrl(request: NextRequest, pathname: string, search?: string): URL {
  const qs = search ?? request.nextUrl.search
  const pathWithQuery = `${pathname}${qs}`

  const siteEnv = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || '')
    .trim()
    .replace(/\/$/, '')
  const nextHost = request.nextUrl.hostname.toLowerCase()
  const loopback = nextHost === 'localhost' || nextHost === '127.0.0.1'

  if (loopback && siteEnv && /^https?:\/\//i.test(siteEnv) && !/localhost|127\.0\.0\.1/i.test(siteEnv)) {
    return new URL(pathWithQuery, `${siteEnv}/`)
  }

  const xfHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  if (xfHost && !/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(xfHost)) {
    const proto =
      request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
      (xfHost.includes('splaro.co') ? 'https' : request.nextUrl.protocol.replace(':', ''))
    return new URL(pathWithQuery, `${proto}://${xfHost}/`)
  }

  const hostHeader = request.headers.get('host')?.split(',')[0]?.trim()
  if (hostHeader && /^(www\.)?splaro\.co$/i.test(hostHeader.split(':')[0] ?? '')) {
    return new URL(pathWithQuery, 'https://splaro.co/')
  }

  if (loopback) {
    const port = request.nextUrl.port || (hostHeader?.includes(':') ? hostHeader.split(':')[1] : '3000')
    return new URL(pathWithQuery, `http://127.0.0.1:${port || '3000'}/`)
  }

  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = qs.startsWith('?') ? qs.slice(1) : qs.replace(/^\?/, '')
  // Clone keeps search via nextUrl; reset from pathWithQuery for safety
  return new URL(pathWithQuery, url.origin)
}

function redirectToShortCollection(request: NextRequest, slug: string) {
  return NextResponse.redirect(publicRedirectUrl(request, `/c/${slug}`), 307)
}

function redirectToTarget(request: NextRequest, target: string, status = 307) {
  if (/^https?:\/\//i.test(target)) {
    if (isAllowedExternalRedirect(target)) {
      return NextResponse.redirect(target, status)
    }
    return NextResponse.next()
  }
  const [path, query] = target.split('?')
  const search = query ? `?${query}` : ''
  return NextResponse.redirect(publicRedirectUrl(request, path ?? target, search), status)
}

/** The host the browser actually asked for, which dev's nextUrl does not carry. */
function devRequestHost(request: NextRequest): { hostname: string; port: string } {
  const raw = (request.headers.get('host') ?? request.nextUrl.host).trim().toLowerCase()
  const match = raw.match(/^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/)
  return {
    hostname: match?.[1] ?? raw,
    port: match?.[2] || request.nextUrl.port || '3000',
  }
}

/**
 * Dev names for *this* machine that are not http://127.0.0.1.
 * The LAN address is deliberately absent: a phone on the same wifi has to keep
 * reaching the laptop by IP, and sending it to 127.0.0.1 would point it at
 * itself. Google sign-in stays hidden there via the origin gate instead.
 */
function isDevLocalAlias(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname === '[::]' ||
    hostname === '::' ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Dev only: canonicalize every local alias → 127.0.0.1 so Google GIS needs one
  // origin (http://127.0.0.1:3000). The dev server binds 0.0.0.0 and the LAN IP,
  // so those hosts answer too — but Chrome only treats localhost and 127.0.0.1
  // as trustworthy, and GIS silently refuses to draw its button anywhere else.
  // Redirecting is kinder than leaving an empty pill on a URL that can never
  // work. Production hosts are never touched.
  if (process.env.NODE_ENV === 'development') {
    // `nextUrl.hostname` reports the address the dev server bound to (0.0.0.0),
    // not the host the browser asked for, so read the Host header instead —
    // otherwise 127.0.0.1 redirects to itself and the page never loads.
    const { hostname, port } = devRequestHost(request)
    if (hostname !== '127.0.0.1' && isDevLocalAlias(hostname)) {
      const target = new URL(
        `${pathname}${request.nextUrl.search}`,
        `http://127.0.0.1:${port}/`,
      )
      return NextResponse.redirect(target, 307)
    }
  }

  // Host canonicalize above also covers /api (GIS redirect callback). Skip the rest.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const gscHtml = pathname.match(/^\/google([A-Za-z0-9_-]+)\.html$/)
  if (gscHtml?.[1]) {
    const token = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim()
    if (token && gscHtml[1] === token) {
      return new NextResponse(`google-site-verification: ${token}`, {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'public, max-age=300',
        },
      })
    }
    const rewrite = request.nextUrl.clone()
    rewrite.pathname = `/api/gsc-verify/${gscHtml[1]}`
    rewrite.search = ''
    return NextResponse.rewrite(rewrite)
  }

  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase()
  if (host === 'www.splaro.co') {
    // Build a fresh URL rather than mutating request.nextUrl.clone() — behind
    // a reverse proxy, NextURL's internal port (e.g. :3000) leaks through the
    // `.host`/`.protocol` setters and produces a broken https://splaro.co:3000 redirect.
    const target = new URL(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      'https://splaro.co',
    )
    // Never let cache-bust junk become a www→apex URL either.
    target.searchParams.delete('_splaro')
    return NextResponse.redirect(target, 301)
  }

  // D2C Funnel Universe: Standalone wildcard subdomains (lifestyle.splaro.co, ls.splaro.co) or custom domains
  const isFunnelHost =
    Boolean(host) &&
    host !== 'splaro.co' &&
    host !== 'localhost' &&
    host !== '127.0.0.1' &&
    !host?.startsWith('192.168.') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/funnel')

  if (isFunnelHost && (pathname === '/' || pathname === '')) {
    const rewrite = request.nextUrl.clone()
    rewrite.pathname = '/funnel/drop'
    rewrite.searchParams.set('host', host!)
    return NextResponse.rewrite(rewrite)
  }

  // Legacy chunk-recovery used ?_splaro=1 — strip so it never indexes / shares.
  if (request.nextUrl.searchParams.has('_splaro')) {
    const clean = publicRedirectUrl(request, request.nextUrl.pathname, '')
    // Preserve other query params except _splaro
    request.nextUrl.searchParams.forEach((value, key) => {
      if (key !== '_splaro') clean.searchParams.set(key, value)
    })
    const res = NextResponse.redirect(clean, 301)
    res.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return res
  }

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

  // Missing PDP: Next soft-200s streamed notFound() — enforce real HTTP 404 here.
  const productMatch = pathname.match(/^\/products\/([^/]+)\/?$/)
  if (productMatch?.[1]) {
    const slug = decodeURIComponent(productMatch[1])
    const exists = await productSlugExists(slug)
    if (exists === false) {
      // Rewrite to route handler (not a page) — handler returns real HTTP 404 body.
      // Behind nginx, prefer http on loopback so standalone does not TLS-fail.
      const missing = request.nextUrl.clone()
      missing.pathname = '/product-missing'
      missing.search = ''
      if (missing.hostname === 'localhost' || missing.hostname === '127.0.0.1') {
        missing.protocol = 'http:'
      }
      const response = NextResponse.rewrite(missing)
      response.headers.set('X-Robots-Tag', 'noindex, nofollow')
      response.headers.set('Cache-Control', 'private, no-store')
      return response
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
  // Include /api so localhost → 127.0.0.1 also covers GIS redirect callback POSTs.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
