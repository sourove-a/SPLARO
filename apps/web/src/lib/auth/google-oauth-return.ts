/** Short-lived cookie: where to send the shopper after GIS redirect login. */

export const GOOGLE_OAUTH_RETURN_COOKIE = 'splaro_google_return'

export function sanitizeGoogleReturnPath(raw: string | null | undefined): string {
  const value = (raw ?? '').trim()
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/account'
  }
  return value.slice(0, 200)
}

function isLoopback(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1'
}

/**
 * `ux_mode=redirect` makes accounts.google.com POST the credential to our
 * callback, so the return path rides a *cross-site* request. A Lax cookie is
 * never sent on one — it was silently dropped, and every Google sign-in landed
 * on /account instead of the page the shopper came from (checkout included).
 * SameSite=None is the only pairing that survives, and it demands Secure.
 * Chrome honours Secure on http loopback, so dev keeps working over 127.0.0.1.
 */
export function googleReturnCookieSameSite(protocol: string, hostname: string): string {
  if (protocol === 'https:' || isLoopback(hostname)) return 'SameSite=None; Secure'
  return 'SameSite=Lax'
}

export function writeGoogleReturnCookie(path: string): void {
  if (typeof document === 'undefined') return
  const safe = sanitizeGoogleReturnPath(path)
  const sameSite = googleReturnCookieSameSite(
    window.location.protocol,
    window.location.hostname,
  )
  document.cookie = `${GOOGLE_OAUTH_RETURN_COOKIE}=${encodeURIComponent(safe)}; Path=/; Max-Age=600; ${sameSite}`
}
