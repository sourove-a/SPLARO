/** Shared SEO helpers for sitemaps, feeds, and absolute asset URLs. */

export const SEO_SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splaro.co').replace(
  /\/+$/,
  '',
)

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function absoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return SEO_SITE_URL
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl
  return `${SEO_SITE_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`
}

export function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
