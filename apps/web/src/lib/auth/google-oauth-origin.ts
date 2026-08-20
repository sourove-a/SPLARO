/**
 * Pure origin gate for storefront Google Identity Services.
 *
 * GIS only draws its button on an origin registered in the Google Cloud client,
 * and only on an origin the browser considers trustworthy. Anywhere else it
 * fails silently, leaving an empty pill the shopper can click forever — so the
 * gate says no up front and the sign-in card shows a hint instead.
 *
 * Loopback stays off unless NEXT_PUBLIC_GOOGLE_OAUTH_LOCAL_ENABLED=true
 * (register http://127.0.0.1:3000 — middleware canonicalizes dev hosts to it).
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
