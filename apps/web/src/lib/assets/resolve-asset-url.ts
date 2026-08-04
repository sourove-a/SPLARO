/**
 * Public asset origin for `/uploads` and absolute CDN URLs.
 * `cdn.splaro.co` / `cdn.splaro.com.bd` are planned but DNS-missing — never
 * route live traffic there (ENOTFOUND / broken images). Prefer working R2 or site origin.
 */

const BROKEN_CDN_HOSTS = new Set(['cdn.splaro.co', 'cdn.splaro.com.bd'])
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1'])

function isUsableOrigin(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase()
    return !BROKEN_CDN_HOSTS.has(host)
  } catch {
    return false
  }
}

/** Upgrade http→https for non-loopback absolute URLs (mixed-content hardening). */
export function upgradeInsecureAbsoluteUrl(value: string): string {
  if (!value.startsWith('http://')) return value
  try {
    const parsed = new URL(value)
    if (LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) return value
    parsed.protocol = 'https:'
    return parsed.toString()
  } catch {
    return value
  }
}

export function getPublicAssetOrigin(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_CDN_URL,
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    'https://splaro.co',
  ]
  for (const raw of candidates) {
    const value = raw?.trim()
    if (!value) continue
    const origin = value.replace(/\/$/, '')
    if (!isUsableOrigin(origin)) continue
    return upgradeInsecureAbsoluteUrl(origin)
  }
  return 'https://splaro.co'
}

function uploadAssetBaseUrl(): string {
  return getPublicAssetOrigin()
}

/** Turn `/uploads/...` and other site-relative asset paths into absolute URLs. */
export function resolveStorefrontAssetUrl(value?: string | null): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return ''
  if (trimmed.startsWith('data:')) return trimmed
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return upgradeInsecureAbsoluteUrl(trimmed)
  }
  if (!trimmed.startsWith('/')) return trimmed

  if (trimmed.startsWith('/uploads/')) {
    return `${uploadAssetBaseUrl()}${trimmed}`
  }

  // Public static assets (/images, /fonts, …) — keep site-relative for Next/Image.
  return trimmed
}
