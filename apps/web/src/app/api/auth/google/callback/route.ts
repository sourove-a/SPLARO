import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { apiAuthGoogle, attachSessionCookie } from '@/lib/server/api-auth'
import { getTrustedClientIp } from '@/lib/server/client-ip'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'
import {
  GOOGLE_OAUTH_RETURN_COOKIE,
  sanitizeGoogleReturnPath,
} from '@/lib/auth/google-oauth-return'
import { buildSignupPhonePath } from '@/lib/auth/signup-phone-path'
import { resolvePostAuthDestination } from '@/lib/auth/post-auth-destination'

/**
 * GIS `ux_mode=redirect` posts the ID token here (form-urlencoded).
 * Popup mode blanks on accounts.google.com/gsi/transform — storefront uses redirect.
 */
function originFrom(request: Request): string {
  try {
    return new URL(request.url).origin
  } catch {
    return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://splaro.co'
  }
}

function redirectTo(request: Request, path: string): NextResponse {
  const url = new URL(path, originFrom(request))
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  return redirectTo(request, '/login')
}

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'auth-google-callback'), 10, 60_000)
  if (!limit.ok) {
    return redirectTo(request, '/login?google_error=rate')
  }

  let credential = ''
  let bodyCsrf = ''
  try {
    const form = await request.formData()
    credential = String(form.get('credential') ?? '').trim()
    bodyCsrf = String(form.get('g_csrf_token') ?? '').trim()
  } catch {
    return redirectTo(request, '/login?google_error=1')
  }

  const cookieStore = await cookies()
  const cookieCsrf = cookieStore.get('g_csrf_token')?.value?.trim() ?? ''
  if (!credential || !bodyCsrf || !cookieCsrf || bodyCsrf !== cookieCsrf) {
    return redirectTo(request, '/login?google_error=csrf')
  }

  const returnRaw = cookieStore.get(GOOGLE_OAUTH_RETURN_COOKIE)?.value
  const nextPath = sanitizeGoogleReturnPath(
    returnRaw ? decodeURIComponent(returnRaw) : '/account',
  )

  const result = await apiAuthGoogle(credential, getTrustedClientIp(request))
  if ('error' in result) {
    const response = redirectTo(
      request,
      `/login?google_error=1&next=${encodeURIComponent(nextPath)}`,
    )
    response.cookies.set(GOOGLE_OAUTH_RETURN_COOKIE, '', { path: '/', maxAge: 0 })
    return response
  }

  const destination =
    result.needsPhone || result.user.needsPhone
      ? buildSignupPhonePath(nextPath)
      : resolvePostAuthDestination(nextPath, result.isNewUser ? 'signup' : 'login')

  const response = redirectTo(request, destination)
  response.cookies.set(GOOGLE_OAUTH_RETURN_COOKIE, '', { path: '/', maxAge: 0 })
  return attachSessionCookie(response, result.sessionToken)
}
