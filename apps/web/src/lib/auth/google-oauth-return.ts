/** Short-lived cookie: where to send the shopper after GIS redirect login. */

export const GOOGLE_OAUTH_RETURN_COOKIE = 'splaro_google_return'

export function sanitizeGoogleReturnPath(raw: string | null | undefined): string {
  const value = (raw ?? '').trim()
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/account'
  }
  return value.slice(0, 200)
}

export function writeGoogleReturnCookie(path: string): void {
  if (typeof document === 'undefined') return
  const safe = sanitizeGoogleReturnPath(path)
  document.cookie = `${GOOGLE_OAUTH_RETURN_COOKIE}=${encodeURIComponent(safe)}; Path=/; Max-Age=600; SameSite=Lax`
}
