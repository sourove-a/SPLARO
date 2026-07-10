const ALLOWED_REDIRECT_HOSTS = new Set([
  'splaro.co',
  'www.splaro.co',
  'splaro.com.bd',
  'www.splaro.com.bd',
])

/** Only SPLARO-owned hosts may be used as absolute redirect targets from middleware rules. */
export function isAllowedExternalRedirect(target: string): boolean {
  try {
    const parsed = new URL(target)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    return ALLOWED_REDIRECT_HOSTS.has(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}
