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

export const SPLARO_DOMAINS = {
  site: env('NEXT_PUBLIC_SITE_URL', env('WEB_URL', isProd ? 'https://splaro.com.bd' : devSite)),
  admin: env('NEXT_PUBLIC_ADMIN_URL', env('ADMIN_URL', isProd ? 'https://admin.splaro.com.bd' : devAdmin)),
  api: env('NEXT_PUBLIC_API_URL', env('API_URL', isProd ? 'https://api.splaro.com.bd' : devApi)),
} as const

/** API base including version prefix — e.g. https://api.splaro.com.bd/api/v1 */
export function getApiBaseUrl(): string {
  const base = SPLARO_DOMAINS.api.replace(/\/+$/, '')
  if (base.endsWith('/api/v1')) return base
  if (base.endsWith('/api')) return `${base}/v1`
  return `${base}/api/v1`
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
