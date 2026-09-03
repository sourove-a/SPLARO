import { getStorefrontOrigin } from '@/lib/storefront-origin'

/**
 * Returns the storefront preview URL for a D2C funnel universe drop.
 * In production (admin.splaro.co), returns https://splaro.co/funnel/drop?drop=<slug>
 * In local dev, returns http://localhost:3000/funnel/drop?drop=<slug> (or 127.0.0.1:3000)
 */
export function funnelStorefrontUrl(slug?: string | null): string {
  const clean = slug?.trim() || 'lifestyle'
  const origin = getStorefrontOrigin().replace(/\/+$/, '')
  return `${origin}/funnel/drop?drop=${encodeURIComponent(clean)}`
}
