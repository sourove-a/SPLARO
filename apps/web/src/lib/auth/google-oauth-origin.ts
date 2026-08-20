/**
 * Pure origin gate for storefront Google Identity Services.
 * Loopback stays off unless NEXT_PUBLIC_GOOGLE_OAUTH_LOCAL_ENABLED=true
 * (register http://127.0.0.1:3000 — web middleware redirects localhost → 127.0.0.1 in dev).
 */

/**
 * The dev server binds 0.0.0.0, so the port answers on it — but Chrome does not
 * count 0.0.0.0 as a trustworthy origin the way it does localhost and 127.0.0.1.
 * On a non-secure context GIS refuses to draw the button and Google will not
 * accept the host as an origin, so the shopper just sees an empty pill. Send
 * them to 127.0.0.1 instead of mounting something that cannot work.
 */
const UNUSABLE_HOSTS = new Set(['0.0.0.0', '[::]', '::'])

export function isGoogleOAuthOriginUnusable(hostname: string): boolean {
  return UNUSABLE_HOSTS.has(hostname.trim().toLowerCase())
}

export function isGoogleOAuthOriginEligible(hostname: string): boolean {
  const localEnabled = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_LOCAL_ENABLED === 'true'
  const normalized = hostname.trim().toLowerCase()
  if (isGoogleOAuthOriginUnusable(normalized)) return false
  const isLoopback =
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '[::1]' ||
    normalized === '::1'

  return !isLoopback || localEnabled
}
