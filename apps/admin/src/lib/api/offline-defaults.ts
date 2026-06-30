import type { HelpdeskOverview } from './commerce-os'
import type { SeoOverview } from './admin-hub'

export const EMPTY_HELPDESK_OVERVIEW: HelpdeskOverview = {
  tickets: [],
  open: 0,
  total: 0,
}

export const EMPTY_SEO_OVERVIEW: SeoOverview = {
  keywords: [],
  indexPages: [],
  schemas: [],
  sitemaps: [],
  redirects: [],
  productAudits: [],
  summary: { avgScore: 0, criticalErrors: 0, warnings: 0, products: 0 },
}

export function isNetworkOrServerError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return true
  const status = (error as { status?: number }).status
  if (status === 0 || (typeof status === 'number' && status >= 500)) return true
  return error instanceof TypeError
}
