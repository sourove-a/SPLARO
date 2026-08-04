/**
 * Pure origin gate for storefront Google Identity Services.
 * Loopback stays off unless NEXT_PUBLIC_GOOGLE_OAUTH_LOCAL_ENABLED=true
 * (and both localhost + 127.0.0.1 are registered in Google Cloud).
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
