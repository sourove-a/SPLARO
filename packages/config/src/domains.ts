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
