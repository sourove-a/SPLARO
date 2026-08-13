/**
 * SPLARO production domain configuration.
 * All apps should read URLs from environment — never hardcode localhost in production.
 */

function env(key: string, fallback: string): string {
  const value = process.env[key]
  if (value && value.trim().length > 0) return value.trim()
  return fallback
}

const isProd = process.env.NODE_ENV === 'production'

const devSite = 'http://localhost:3000'
const devAdmin = 'http://localhost:3001'
const devApi = 'http://localhost:4000'

/** Normalize any API origin to …/api/v1 */
function normalizeApiBase(base: string): string {
  const trimmed = base.replace(/\/+$/, '')
  if (trimmed.endsWith('/api/v1')) return trimmed
  if (trimmed.endsWith('/api')) return `${trimmed}/v1`
  return `${trimmed}/api/v1`
}

export const SPLARO_DOMAINS = {
  site: env('NEXT_PUBLIC_SITE_URL', env('WEB_URL', isProd ? 'https://splaro.co' : devSite)),
  admin: env('NEXT_PUBLIC_ADMIN_URL', env('ADMIN_URL', isProd ? 'https://admin.splaro.co' : devAdmin)),
  // Hostinger: same-origin proxy at splaro.co/api/v1 (api.splaro.co optional)
  api: env('NEXT_PUBLIC_API_URL', env('API_URL', isProd ? 'https://splaro.co/api/v1' : devApi)),
} as const

/** Public API base — browser + SSR HTML. e.g. https://splaro.co/api/v1 */
export function getApiBaseUrl(): string {
  return normalizeApiBase(SPLARO_DOMAINS.api)
}

/**
 * Server-only API base — prefers loopback on same-box VPS so SSR/sitemap never
 * round-trips through external TLS/proxy (fixes timeout + connection flakes).
 *
 * Order: INTERNAL_API_URL → same-box flags (SPLARO_VPS / SPLARO_HOSTINGER) →
 * local dev 127.0.0.1 → public API URL.
 */
export function getServerApiBaseUrl(): string {
  const internal = process.env.INTERNAL_API_URL?.trim()
  if (internal) return normalizeApiBase(internal)

  const onSameBox =
    process.env.SPLARO_VPS === '1' ||
    process.env.SPLARO_HOSTINGER === '1' ||
    (typeof process.env.HOME === 'string' && process.env.HOME.includes('domains/splaro.co'))

  if (onSameBox) {
    const port = process.env.API_PORT ?? process.env.PORT_API ?? '4000'
    return normalizeApiBase(`http://127.0.0.1:${port}`)
  }

  const publicBase = getApiBaseUrl()
  // Local SSR/BFF: prefer IPv4 loopback — Windows often stalls on localhost → ::1.
  if (!isProd && /localhost/i.test(publicBase)) {
    const port = process.env.PORT_API ?? process.env.API_PORT ?? String(SPLARO_PORTS.api)
    return normalizeApiBase(`http://127.0.0.1:${port}`)
  }

  return publicBase
}

/** Parse CORS origins from env (supports CORS_ORIGIN and CORS_ORIGINS) */
export function getCorsOrigins(): string[] {
  const raw = env('CORS_ORIGINS', env('CORS_ORIGIN', `${SPLARO_DOMAINS.site},${SPLARO_DOMAINS.admin}`))
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

export const SPLARO_PORTS = {
  web: Number(env('PORT_WEB', '3000')),
  admin: Number(env('PORT_ADMIN', '3001')),
  api: Number(env('PORT_API', env('API_PORT', '4000'))),
} as const

/**
 * Admin health/ping “is the storefront process up?”
 *
 * Local Next loads root `.env` where NEXT_PUBLIC_SITE_URL is often https://splaro.co.
 * Probing that host from `:3001` reports production, not `pnpm dev:web`.
 * Non-production always uses IPv4 loopback (Windows `localhost` → ::1 stalls).
 */
export function getStorefrontProbeOrigin(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  port: string | undefined = process.env.PORT_WEB,
): string {
  if (nodeEnv === 'production') {
    return SPLARO_DOMAINS.site.replace(/\/+$/, '')
  }
  const webPort = (port ?? '').trim() || String(SPLARO_PORTS.web)
  return `http://127.0.0.1:${webPort}`
}

function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.replace(/^www\./, '').toLowerCase()
  return (
    !h ||
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h === '[::1]' ||
    h.endsWith('.local') ||
    h.endsWith('.localhost')
  )
}

/**
 * Public storefront origin for apps / SSR / admin “open site” links.
 * In production never returns localhost/127.0.0.1.
 * Local dev may return localhost so browser tools still work.
 */
export function resolvePublicSiteUrl(override?: string | null): string {
  const candidates = [
    override,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.WEB_URL,
    process.env.NEXT_PUBLIC_WEB_URL,
    process.env.SITE_URL,
    SPLARO_DOMAINS.site,
    isProd ? 'https://splaro.co' : devSite,
  ]
  for (const candidate of candidates) {
    const raw = candidate?.trim()
    if (!raw) continue
    try {
      const url = new URL(raw)
      if (isProd && isLoopbackHostname(url.hostname)) continue
      return url.origin
    } catch {
      /* try next */
    }
  }
  return isProd ? 'https://splaro.co' : SPLARO_DOMAINS.site.replace(/\/+$/, '')
}

/**
 * Customer-facing storefront origin for emails, invoices, SMS, Telegram store links.
 * Never returns localhost / 127.0.0.1 / *.local — even in development —
 * so order confirmation emails always deep-link to https://splaro.co.
 */
export function resolveCustomerFacingSiteUrl(override?: string | null): string {
  const candidates = [
    override,
    process.env.COMPANY_WEBSITE,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.WEB_URL,
    process.env.NEXT_PUBLIC_WEB_URL,
    process.env.SITE_URL,
    'https://splaro.co',
  ]
  for (const candidate of candidates) {
    const raw = candidate?.trim()
    if (!raw) continue
    try {
      const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
      if (isLoopbackHostname(url.hostname)) continue
      return url.origin
    } catch {
      /* try next */
    }
  }
  return 'https://splaro.co'
}

/**
 * Absolute URL safe for Google Sheets, emails, invoices and other external
 * surfaces. Loopback origins are rewritten to the customer-facing SPLARO
 * origin while preserving the asset path and query string.
 */
export function resolveCustomerFacingAssetUrl(value?: string | null): string {
  const raw = value?.trim()
  if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return ''

  const site = resolveCustomerFacingSiteUrl()
  try {
    const url = new URL(raw, `${site}/`)
    if (isLoopbackHostname(url.hostname)) {
      const canonical = new URL(site)
      url.protocol = canonical.protocol
      url.hostname = canonical.hostname
      url.port = canonical.port
    }
    return url.toString()
  } catch {
    const path = raw.startsWith('/') ? raw : `/${raw}`
    return `${site}${path}`
  }
}

/**
 * Payment-gateway callback URLs must stay on SPLARO API hosts under `/payments/`.
 * Foreign origins (open redirect / callback injection) fall back to the fixed path.
 */
export function resolveAllowedPaymentCallbackUrl(
  value: string | null | undefined,
  fallbackPath: string,
): string {
  const apiBase = resolveCustomerFacingApiBase()
  const path = fallbackPath.startsWith('/') ? fallbackPath : `/${fallbackPath}`
  const fallback = `${apiBase}${path}`
  const raw = value?.trim()
  if (!raw) return fallback

  try {
    const rewritten = resolveCustomerFacingAssetUrl(raw)
    if (!rewritten) return fallback
    const url = new URL(rewritten)
    const apiHost = new URL(apiBase).hostname.replace(/^www\./, '').toLowerCase()
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    const allowedHosts = new Set([apiHost, 'splaro.co', 'api.splaro.co'])
    if (!allowedHosts.has(host)) return fallback
    if (!/\/payments\//i.test(url.pathname)) return fallback
    return url.toString()
  } catch {
    return fallback
  }
}

/** Public admin origin — never localhost in production. */
export function resolvePublicAdminUrl(override?: string | null): string {
  const candidates = [
    override,
    process.env.ADMIN_URL,
    process.env.NEXT_PUBLIC_ADMIN_URL,
    SPLARO_DOMAINS.admin,
    isProd ? 'https://admin.splaro.co' : devAdmin,
  ]
  for (const candidate of candidates) {
    const raw = candidate?.trim()
    if (!raw) continue
    try {
      const url = new URL(raw)
      if (isProd && isLoopbackHostname(url.hostname)) continue
      return url.origin
    } catch {
      /* try next */
    }
  }
  return isProd ? 'https://admin.splaro.co' : SPLARO_DOMAINS.admin.replace(/\/+$/, '')
}

/**
 * Admin origin for Telegram buttons / externally shared ops links.
 * Never returns localhost — even in development.
 */
export function resolveCustomerFacingAdminUrl(override?: string | null): string {
  const candidates = [
    override,
    process.env.ADMIN_URL,
    process.env.NEXT_PUBLIC_ADMIN_URL,
    'https://admin.splaro.co',
  ]
  for (const candidate of candidates) {
    const raw = candidate?.trim()
    if (!raw) continue
    try {
      const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
      if (isLoopbackHostname(url.hostname)) continue
      return url.origin
    } catch {
      /* try next */
    }
  }
  return 'https://admin.splaro.co'
}

/** Public API origin (no `/api/v1`) — OAuth callbacks, etc. */
export function resolvePublicApiOrigin(override?: string | null): string {
  const candidates = [
    override,
    process.env.API_URL,
    process.env.NEXT_PUBLIC_API_URL,
    SPLARO_DOMAINS.api,
    isProd ? 'https://api.splaro.co' : devApi,
  ]
  for (const candidate of candidates) {
    const raw = candidate?.trim()
    if (!raw) continue
    try {
      const url = new URL(raw.replace(/\/api\/v1\/?$/i, '').replace(/\/api\/?$/i, ''))
      if (isProd && isLoopbackHostname(url.hostname)) continue
      return url.origin
    } catch {
      /* try next */
    }
  }
  return isProd ? 'https://api.splaro.co' : 'http://localhost:4000'
}

/**
 * Public API base (`…/api/v1`) for payment-gateway callbacks and other
 * externally reachable endpoints. Never returns loopback — gateways cannot
 * hit 127.0.0.1 even when the Nest process itself is local to the VPS.
 */
export function resolveCustomerFacingApiBase(override?: string | null): string {
  const candidates = [
    override,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.API_URL,
    'https://splaro.co/api/v1',
  ]
  for (const candidate of candidates) {
    const raw = candidate?.trim()
    if (!raw) continue
    try {
      const normalized = normalizeApiBase(raw)
      const origin = new URL(normalized.replace(/\/api\/v1\/?$/i, '') || normalized)
      if (isLoopbackHostname(origin.hostname)) continue
      return normalized
    } catch {
      /* try next */
    }
  }
  return 'https://splaro.co/api/v1'
}

/**
 * Persist media as portable paths when the host is loopback or SPLARO itself.
 * External CDNs stay absolute. Loopback origins never enter the database.
 */
export function toStoredMediaUrl(value?: string | null): string {
  const raw = value?.trim()
  if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return ''
  if (raw.startsWith('/')) return raw

  try {
    const site = resolveCustomerFacingSiteUrl()
    const url = new URL(raw)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    const siteHost = new URL(site).hostname.replace(/^www\./, '').toLowerCase()
    if (
      isLoopbackHostname(host) ||
      host === siteHost ||
      host === 'admin.splaro.co' ||
      host === 'api.splaro.co'
    ) {
      return `${url.pathname}${url.search}`
    }
    return url.toString()
  } catch {
    return raw.startsWith('/') ? raw : `/${raw}`
  }
}
