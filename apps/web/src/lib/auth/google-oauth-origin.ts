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
 * The dev server binds 0.0.0.0 and the LAN address, so the port answers there,
 * but Chrome only treats localhost and 127.0.0.1 as trustworthy and neither
 * host can be registered with Google. Phone-on-wifi testing lands on the LAN IP.
 */
function isUnusableDevHost(hostname: string): boolean {
  if (hostname === '0.0.0.0' || hostname === '[::]' || hostname === '::') return true
  return (
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  )
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  )
}

export function isGoogleOAuthOriginEligible(hostname: string): boolean {
  const localEnabled = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_LOCAL_ENABLED === 'true'
  const normalized = hostname.trim().toLowerCase()
  if (isUnusableDevHost(normalized)) return false
  if (isLoopbackHost(normalized)) return localEnabled
  return true
}
