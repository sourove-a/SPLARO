/**
 * Pure origin gate for storefront Google Identity Services.
 * Loopback stays off unless NEXT_PUBLIC_GOOGLE_OAUTH_LOCAL_ENABLED=true
 * (register http://127.0.0.1:3000 — web middleware redirects localhost → 127.0.0.1 in dev).
 */
export function isGoogleOAuthOriginEligible(hostname: string): boolean {
  const localEnabled = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_LOCAL_ENABLED === 'true'
  const normalized = hostname.trim().toLowerCase()
  const isLoopback =
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '[::1]' ||
    normalized === '::1'

  return !isLoopback || localEnabled
}
