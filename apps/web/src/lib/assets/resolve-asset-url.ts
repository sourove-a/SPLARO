/**
 * Public asset origin for `/uploads` and absolute CDN URLs.
 * `cdn.splaro.co` / `cdn.splaro.com.bd` are planned but DNS-missing — never
 * route live traffic there (ENOTFOUND / broken images). Prefer working R2 or site origin.
 */

const BROKEN_CDN_HOSTS = new Set(['cdn.splaro.co', 'cdn.splaro.com.bd'])

function isUsableOrigin(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase()
    return !BROKEN_CDN_HOSTS.has(host)
  } catch {
    return false
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
    return origin
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
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed
  }
  if (!trimmed.startsWith('/')) return trimmed

  if (trimmed.startsWith('/uploads/')) {
    return `${uploadAssetBaseUrl()}${trimmed}`
  }

  // Public static assets (/images, /fonts, …) — keep site-relative for Next/Image.
  return trimmed
}
