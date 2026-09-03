import { getStorefrontOrigin } from '@/lib/storefront-origin'

export interface FunnelTarget {
  slug?: string | null | undefined
  subdomain?: string | null | undefined
  domain?: string | null | undefined
}

/**
 * Returns the storefront preview URL for a D2C funnel universe drop.
 * - In local dev: always returns local drop route e.g. http://localhost:3000/funnel/drop?drop=<slug>
 * - In production (admin.splaro.co):
 *     1. If valid custom root domain exists (e.g. exclusivewatch.shop) -> https://exclusivewatch.shop
 *     2. If subdomain exists (e.g. lifestyle) -> https://lifestyle.splaro.co
 *     3. Otherwise falls back to https://splaro.co/funnel/drop?drop=<slug>
 */
export function funnelStorefrontUrl(target?: string | FunnelTarget | null): string {
  const opts: FunnelTarget =
    typeof target === 'string'
      ? { slug: target }
      : target || {}

  const rawSlug = opts.slug?.trim() || opts.subdomain?.trim() || 'lifestyle'
  const origin = getStorefrontOrigin().replace(/\/+$/, '')

  // On local dev (localhost / 127.0.0.1), subdomains don't resolve locally
  const isLocalDev =
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.includes('0.0.0.0')

  if (isLocalDev) {
    return `${origin}/funnel/drop?drop=${encodeURIComponent(rawSlug)}`
  }

  // In production: custom root domain (must contain a dot, e.g. "mybrand.com")
  const customDomain = opts.domain?.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  if (customDomain && customDomain.includes('.')) {
    return `https://${customDomain}`
  }

  // In production: subdomain on splaro.co (e.g. "lifestyle" -> "https://lifestyle.splaro.co")
  // If user typed a single name in domain field without dot, treat it as a subdomain
  const sub = (opts.subdomain?.trim() || (opts.domain && !opts.domain.includes('.') ? opts.domain.trim() : ''))
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')

  if (sub) {
    return `https://${sub}.splaro.co`
  }

  // Fallback if no subdomain
  return `${origin}/funnel/drop?drop=${encodeURIComponent(rawSlug)}`
}
