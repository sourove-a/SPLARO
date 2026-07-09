import type { NextRequest } from 'next/server'

/** Public admin origin — safe behind nginx/PM2 (avoids localhost redirects). */
export function getAdminRequestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = (forwardedHost ?? request.headers.get('host') ?? '').split(',')[0]?.trim()

  if (host && !host.includes('localhost') && !host.startsWith('127.0.0.1')) {
    const proto = request.headers.get('x-forwarded-proto') ?? 'https'
    return `${proto}://${host}`
  }

  const configured = process.env.NEXT_PUBLIC_ADMIN_URL ?? process.env.ADMIN_URL
  if (configured?.trim()) {
    return configured.trim().replace(/\/$/, '')
  }

  return request.nextUrl.origin
}
