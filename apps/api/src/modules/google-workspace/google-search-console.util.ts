import { WEBMASTERS_READONLY_SCOPE } from './google.constants'

export type GscRangeId = '7d' | '28d' | '90d'
export type GscSortKey = 'clicks' | 'impressions' | 'ctr' | 'position'
export type GscStatusCode =
  | 'connected'
  | 'not_connected'
  | 'needs_reconnect'
  | 'missing_property'
  | 'quota'
  | 'error'

export type GscErrorCategory =
  | 'not_connected'
  | 'needs_reconnect'
  | 'missing_property'
  | 'quota'
  | 'outage'
  | 'invalid_url'
  | 'error'

export type GscSiteEntry = { siteUrl?: string | null; permissionLevel?: string | null }

export type GscRow = {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export type GscInsightKind = 'high_impressions_low_ctr' | 'position_8_15' | 'clicks_down'

export type GscInsight = {
  kind: GscInsightKind
  label: string
  detail: string
  page?: string
  query?: string
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
  previousClicks?: number
}

const RANGE_DAYS: Record<GscRangeId, number> = { '7d': 7, '28d': 28, '90d': 90 }
const GSC_DATA_LAG_DAYS = 2
const DHAKA_TZ = 'Asia/Dhaka'

export function parseGscRange(raw?: string | null): GscRangeId {
  if (raw === '7d' || raw === '90d') return raw
  return '28d'
}

export function parseGscSort(raw?: string | null): GscSortKey {
  if (raw === 'impressions' || raw === 'ctr' || raw === 'position') return raw
  return 'clicks'
}

export function gscRangeDays(range: GscRangeId): number {
  return RANGE_DAYS[range]
}

/** YYYY-MM-DD in Asia/Dhaka. */
export function dhakaYmd(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DHAKA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function addDaysYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number)
  const utc = Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days)
  return new Date(utc).toISOString().slice(0, 10)
}

export function gscDateWindow(range: GscRangeId, now = new Date()): {
  startDate: string
  endDate: string
  previousStart: string
  previousEnd: string
  days: number
} {
  const days = gscRangeDays(range)
  const today = dhakaYmd(now)
  const endDate = addDaysYmd(today, -GSC_DATA_LAG_DAYS)
  const startDate = addDaysYmd(endDate, -(days - 1))
  const previousEnd = addDaysYmd(startDate, -1)
  const previousStart = addDaysYmd(previousEnd, -(days - 1))
  return { startDate, endDate, previousStart, previousEnd, days }
}

export function hasWebmastersReadonlyScope(...scopeBlobs: Array<string | null | undefined>): boolean {
  const haystack = scopeBlobs
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .toLowerCase()
  return haystack.includes(WEBMASTERS_READONLY_SCOPE.toLowerCase())
}

export function allowedGscHosts(siteOrigin?: string | null): Set<string> {
  const hosts = new Set<string>(['splaro.co', 'www.splaro.co'])
  if (siteOrigin?.trim()) {
    try {
      hosts.add(new URL(siteOrigin).hostname.toLowerCase())
    } catch {
      /* ignore */
    }
  }
  return hosts
}

export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')
}

/**
 * Only SPLARO storefront URLs (and local loopback in non-prod). Rejects
 * javascript:, data:, other hosts, and arbitrary external inspection.
 */
export function assertSplaroInspectUrl(
  raw: string,
  siteOrigin?: string | null,
): { ok: true; url: string } | { ok: false; reason: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, reason: 'URL is required.' }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, reason: 'URL is not valid.' }
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'URL must not include credentials.' }
  }
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopbackHost(parsed.hostname))) {
    return { ok: false, reason: 'Only https://splaro.co URLs can be inspected.' }
  }
  const host = parsed.hostname.toLowerCase()
  const allowed = allowedGscHosts(siteOrigin)
  if (!allowed.has(host) && !isLoopbackHost(host)) {
    return { ok: false, reason: 'URL must belong to splaro.co.' }
  }
  parsed.hash = ''
  return { ok: true, url: parsed.toString() }
}

export function knownStorefrontSitemaps(siteOrigin: string): string[] {
  const origin = siteOrigin.replace(/\/+$/, '')
  return [`${origin}/sitemap.xml`, `${origin}/sitemap-images.xml`]
}

export function pickSearchConsoleProperty(
  sites: GscSiteEntry[],
  preferred?: string | null,
): { property: string; permission: string | null } | null {
  const entries = sites
    .map((site) => ({
      property: site.siteUrl?.trim() ?? '',
      permission: site.permissionLevel?.trim() || null,
    }))
    .filter((site) => site.property)

  if (entries.length === 0) return null

  const preferredTrimmed = preferred?.trim()
  if (preferredTrimmed) {
    const exact = entries.find((site) => site.property === preferredTrimmed)
    if (exact) return exact
  }

  const domain = entries.find((site) => site.property.toLowerCase() === 'sc-domain:splaro.co')
  if (domain) return domain

  const httpsRoot = entries.find((site) => {
    try {
      const url = new URL(site.property)
      return url.protocol === 'https:' && url.hostname.toLowerCase() === 'splaro.co' && url.pathname === '/'
    } catch {
      return false
    }
  })
  if (httpsRoot) return httpsRoot

  const anySplaro = entries.find((site) => {
    const value = site.property.toLowerCase()
    if (value.includes('splaro.co')) return true
    try {
      return new URL(site.property).hostname.toLowerCase().endsWith('splaro.co')
    } catch {
      return false
    }
  })
  return anySplaro ?? null
}

export function normalizeGscRow(row: {
  keys?: string[] | null
  clicks?: number | null
  impressions?: number | null
  ctr?: number | null
  position?: number | null
}): GscRow {
  const clicks = Number(row.clicks ?? 0)
  const impressions = Number(row.impressions ?? 0)
  const ctr = impressions > 0 ? clicks / impressions : Number(row.ctr ?? 0)
  return {
    keys: Array.isArray(row.keys) ? row.keys.map((key) => String(key)) : [],
    clicks,
    impressions,
    ctr,
    position: Number(row.position ?? 0),
  }
}

export function sortGscRows(rows: GscRow[], sort: GscSortKey): GscRow[] {
  const copy = [...rows]
  copy.sort((a, b) => {
    if (sort === 'position') return a.position - b.position || b.impressions - a.impressions
    if (sort === 'ctr') return b.ctr - a.ctr || b.impressions - a.impressions
    if (sort === 'impressions') return b.impressions - a.impressions || b.clicks - a.clicks
    return b.clicks - a.clicks || b.impressions - a.impressions
  })
  return copy
}

export function productSlugFromPageUrl(pageUrl: string): string | null {
  try {
    const path = new URL(pageUrl).pathname
    const match = path.match(/^\/products\/([^/]+)\/?$/)
    return match?.[1] ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}

export function buildGscInsights(input: {
  queries: GscRow[]
  pages: GscRow[]
  previousPages?: GscRow[]
}): GscInsight[] {
  const insights: GscInsight[] = []

  for (const row of input.queries) {
    const query = row.keys[0]
    if (!query) continue
    if (row.impressions >= 100 && row.ctr < 0.02) {
      insights.push({
        kind: 'high_impressions_low_ctr',
        label: 'High impressions + low CTR',
        detail: `"${query}" has ${row.impressions} impressions at ${(row.ctr * 100).toFixed(1)}% CTR.`,
        query,
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: row.ctr,
        position: row.position,
      })
    }
    if (row.position >= 8 && row.position <= 15 && row.impressions >= 20) {
      insights.push({
        kind: 'position_8_15',
        label: 'Position 8–15 opportunity',
        detail: `"${query}" ranks at ${row.position.toFixed(1)} with ${row.impressions} impressions.`,
        query,
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: row.ctr,
        position: row.position,
      })
    }
  }

  const previousByPage = new Map(
    (input.previousPages ?? []).map((row) => [row.keys[0] ?? '', row] as const),
  )
  for (const row of input.pages) {
    const page = row.keys[0]
    if (!page) continue
    const previous = previousByPage.get(page)
    if (!previous || previous.clicks < 5) continue
    const drop = (previous.clicks - row.clicks) / previous.clicks
    if (drop >= 0.2) {
      insights.push({
        kind: 'clicks_down',
        label: 'Clicks down vs previous period',
        detail: `${page} dropped from ${previous.clicks} to ${row.clicks} clicks.`,
        page,
        clicks: row.clicks,
        previousClicks: previous.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })
    }
  }

  return insights.slice(0, 12)
}

export function classifyGscError(error: unknown): { category: GscErrorCategory; message: string } {
  const status = readErrorStatus(error)
  const raw = error instanceof Error ? error.message : String(error ?? 'Search Console request failed')
  const safe = sanitizeGscErrorMessage(raw)

  if (status === 401 || /invalid_grant|invalid credentials|unauthenticated|token.*revok/i.test(safe)) {
    return { category: 'needs_reconnect', message: 'Google token expired or revoked. Reconnect Google Workspace.' }
  }
  if (status === 429 || /quota|rate limit/i.test(safe)) {
    return { category: 'quota', message: 'Search Console API quota reached. Try again later.' }
  }
  if (status === 403 || /insufficient|forbidden|permission|not a verified/i.test(safe)) {
    return {
      category: 'missing_property',
      message: 'This Google account cannot access the SPLARO Search Console property.',
    }
  }
  if (status >= 500 || /unavailable|econnreset|etimedout|socket/i.test(safe)) {
    return { category: 'outage', message: 'Google Search Console is temporarily unavailable.' }
  }
  return { category: 'error', message: safe || 'Search Console request failed.' }
}

export function sanitizeGscErrorMessage(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/refresh_token=[^&\s]+/gi, 'refresh_token=[redacted]')
    .replace(/access_token=[^&\s]+/gi, 'access_token=[redacted]')
    .replace(/client_secret=[^&\s]+/gi, 'client_secret=[redacted]')
    .replace(/code=[^&\s]+/gi, 'code=[redacted]')
    .slice(0, 280)
}

function readErrorStatus(error: unknown): number {
  if (!error || typeof error !== 'object') return 0
  const withResponse = error as { response?: { status?: number }; code?: number | string; status?: number }
  if (typeof withResponse.response?.status === 'number') return withResponse.response.status
  if (typeof withResponse.status === 'number') return withResponse.status
  if (typeof withResponse.code === 'number') return withResponse.code
  if (typeof withResponse.code === 'string' && /^\d+$/.test(withResponse.code)) return Number(withResponse.code)
  return 0
}
