/**
 * Public analytics (GA4 / Google Ads / Meta Pixel) must never run on
 * localhost, Playwright, or admin hosts unless explicitly opted in.
 */
export function isPublicAnalyticsEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === '1') return true
  if (process.env.NODE_ENV !== 'production') return false
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim()
  if (/localhost|127\.0\.0\.1/i.test(site)) return false
  return true
}

export function isBrowserAnalyticsAllowed(): boolean {
  if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === '1') return true
  if (typeof navigator !== 'undefined' && navigator.webdriver) return false
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.startsWith('admin.')
    ) {
      return false
    }
  }
  return isPublicAnalyticsEnabled()
}
