import { createHmac, timingSafeEqual } from 'crypto'

export interface AdminSessionPayload {
  userId: string
  email: string
  name: string
  role: string
  storeId?: string
  /** Encoded matrix tokens, e.g. orders:view — omitted on legacy sessions (role defaults apply). */
  permissions?: string[]
  exp: number
}

function getSecret(): string {
  const secret = process.env['ADMIN_SESSION_SECRET'] ?? process.env['JWT_SECRET']
  if (secret) return secret
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('ADMIN_SESSION_SECRET (or JWT_SECRET) must be set in production')
  }
  return 'splaro-dev-admin-session-change-me'
}

function decodeStringBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  return Buffer.from(padded + pad, 'base64').toString('utf8')
}

function hmacBase64Url(message: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(message)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function verifyAdminSessionToken(token: string): AdminSessionPayload | null {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null

  const expected = hmacBase64Url(body, getSecret())
  const sigBuf = Buffer.from(sig)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null

  try {
    const payload = JSON.parse(decodeStringBase64Url(body)) as AdminSessionPayload
    if (!payload.exp || payload.exp < Date.now()) return null
    if (!payload.userId || !payload.email || !payload.role) return null
    return payload
  } catch {
    return null
  }
}

/** Route prefixes that stay public (storefront, payments, health). */
export const PUBLIC_ROUTE_PREFIXES = [
  'storefront',
  'payments',
  'telegram-webhook',
  'agent/telegram',
  'mobile/auth',
] as const

/** Storefront search/SEO paths that may be called without admin auth. */
const PUBLIC_READ_PATHS = new Set([
  'search',
  'search/suggest',
  'search/analytics/track',
  'seo/sitemap',
  'seo/schema/organization',
  'seo/schema/breadcrumb',
])

export function isPublicApiPath(path: string, method = 'GET'): boolean {
  const normalized = path.replace(/^\/api\/v1\//, '').replace(/^\//, '')
  const verb = method.toUpperCase()

  if (!normalized) return false

  if (normalized === 'health') return true

  if (normalized === 'health/full' && verb === 'GET') return true

  if (normalized === 'health/routes' && verb === 'GET') return true

  if (normalized === 'admin/auth/login' && verb === 'POST') return true
  if (normalized === 'admin/auth/request-login' && verb === 'POST') return true

  if (normalized.startsWith('health/')) {
    return false
  }

  if (PUBLIC_READ_PATHS.has(normalized)) return true

  if (normalized.startsWith('seo/sitemap/') && verb === 'GET') return true
  if (normalized.startsWith('seo/schema/product/') && verb === 'GET') return true

  if (normalized === 'search/analytics/track' && verb === 'POST') return true
  if (normalized.startsWith('search/analytics/') && normalized.endsWith('/click') && verb === 'PATCH') {
    return true
  }

  return PUBLIC_ROUTE_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  )
}

const WRITE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER'])

export function canWriteAdmin(role: string): boolean {
  return WRITE_ROLES.has(role.toUpperCase())
}
