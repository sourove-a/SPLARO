import { getStorefrontOrigin } from '@/lib/storefront-origin'
import { resolveMediaUrl } from '@/lib/media-url'
import type { DcTone } from '@/components/dc/tokens'
import type { MediaUsage } from '@/lib/api/media'

/** Planned CDN hosts with no DNS — never copy these into a paste buffer. */
const DEAD_CDN_HOSTS = new Set(['cdn.splaro.co', 'cdn.splaro.com.bd'])

export function relativeMediaPath(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('/')) return trimmed.split('?')[0] ?? trimmed
  try {
    return new URL(trimmed).pathname
  } catch {
    return trimmed
  }
}

/**
 * Same-origin src for admin (rewrites `/uploads` to the storefront). Prefer this
 * for in-app preview and blob downloads so the browser is not blocked by CORS.
 */
export function sameOriginMediaSrc(url: string): string {
  const relative = relativeMediaPath(url)
  if (relative.startsWith('/uploads/') || relative.startsWith('/images/')) return relative
  return resolveMediaUrl(url)
}

function usableOrigin(raw: string | undefined): string | null {
  const origin = raw?.trim().replace(/\/$/, '')
  if (!origin) return null
  try {
    const host = new URL(origin).hostname.toLowerCase()
    if (DEAD_CDN_HOSTS.has(host)) return null
    return origin
  } catch {
    return null
  }
}

/**
 * Public URL that will actually load. Skips dead `cdn.splaro.*` hosts and uses
 * a configured CDN / R2 origin only when it is a real origin.
 */
export function cdnSafeMediaUrl(url: string): string {
  const relative = relativeMediaPath(url)
  const origins = [
    usableOrigin(process.env.NEXT_PUBLIC_CDN_URL),
    usableOrigin(process.env.NEXT_PUBLIC_R2_PUBLIC_URL),
    usableOrigin(getStorefrontOrigin()),
  ]
  for (const origin of origins) {
    if (!origin) continue
    if (relative.startsWith('/')) return `${origin}${relative}`
  }
  return resolveMediaUrl(url)
}

export function publicMediaUrl(url: string, publicUrl?: string | null): string {
  if (publicUrl?.startsWith('http://') || publicUrl?.startsWith('https://')) {
    try {
      const host = new URL(publicUrl).hostname.toLowerCase()
      if (!DEAD_CDN_HOSTS.has(host)) return publicUrl
    } catch {
      /* fall through */
    }
  }
  return resolveMediaUrl(url)
}

export type MediaCopyKind = 'publicUrl' | 'relativePath' | 'markdown' | 'html' | 'cdnSafe'

export type MediaCopyPayload = {
  kind: MediaCopyKind
  label: string
  value: string
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

export function mediaCopyPayloads(input: {
  url: string
  publicUrl?: string | null
  altText?: string | null
  width?: number | null
  height?: number | null
}): MediaCopyPayload[] {
  const publicUrl = publicMediaUrl(input.url, input.publicUrl)
  const relative = relativeMediaPath(input.url) || relativeMediaPath(publicUrl)
  const alt = (input.altText ?? '').trim()
  const mdAlt = (alt || 'image').replace(/[[\]]/g, '')
  const sizeAttrs =
    input.width && input.height ? ` width="${input.width}" height="${input.height}"` : ''
  return [
    { kind: 'publicUrl', label: 'Public URL', value: publicUrl },
    { kind: 'relativePath', label: 'Relative path', value: relative || publicUrl },
    { kind: 'markdown', label: 'Markdown', value: `![${mdAlt}](${publicUrl})` },
    {
      kind: 'html',
      label: 'HTML <img>',
      value: `<img src="${escapeAttr(publicUrl)}" alt="${escapeAttr(alt)}"${sizeAttrs} />`,
    },
    { kind: 'cdnSafe', label: 'CDN-safe URL', value: cdnSafeMediaUrl(input.url) },
  ]
}

export function resolutionGrade(
  width?: number | null,
  height?: number | null,
): { label: string; tone: DcTone; title: string } {
  if (!width || !height) {
    return { label: '—', tone: 'mute', title: 'Pixel size not indexed' }
  }
  const min = Math.min(width, height)
  const title = `${width}×${height} px`
  if (min >= 1600) return { label: 'Sharp', tone: 'ok', title }
  if (min >= 800) return { label: 'OK', tone: 'info', title }
  return { label: 'Soft', tone: 'warn', title }
}

export function formatMediaBytes(bytes?: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function formatMediaDate(value?: string | null): string {
  if (!value?.trim()) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

export function usageOwnerHref(usage: MediaUsage): string | null {
  switch (usage.type) {
    case 'product':
    case 'variant':
      return '/dashboard/products'
    case 'hero':
      return '/dashboard/hero-slider'
    case 'category':
      return '/dashboard/categories'
    case 'collection':
      return '/dashboard/collections'
    case 'order':
      return '/dashboard/orders'
    case 'blog':
      return '/dashboard/blog'
    case 'page':
      return '/dashboard/cms'
    case 'settings':
      return '/dashboard/settings'
    case 'menu':
      return '/dashboard/menu-control'
    case 'wholesale':
      return '/dashboard/wholesale-leads'
    case 'partner':
      return '/dashboard/finance/partner-accounts'
    case 'seo':
      return '/dashboard/seo-health'
    case 'brand':
      return '/dashboard/brands'
    case 'staff':
      return '/dashboard/admin-users'
    default:
      return null
  }
}

export function downloadFilename(name: string, url: string, mimeType?: string | null): string {
  const base = name.trim().replace(/[/\\?%*:|"<>]/g, '-') || 'media'
  if (/\.[a-z0-9]{2,5}$/i.test(base)) return base
  const fromPath = relativeMediaPath(url).split('/').pop() ?? ''
  const extFromPath = fromPath.match(/(\.[a-z0-9]{2,5})$/i)?.[1]
  if (extFromPath) return `${base}${extFromPath}`
  const mime = (mimeType ?? '').toLowerCase()
  const ext =
    mime === 'image/jpeg'
      ? '.jpg'
      : mime === 'image/png'
        ? '.png'
        : mime === 'image/webp'
          ? '.webp'
          : mime === 'image/gif'
            ? '.gif'
            : mime === 'image/avif'
              ? '.avif'
              : mime === 'image/svg+xml'
                ? '.svg'
                : mime === 'application/pdf'
                  ? '.pdf'
                  : mime.startsWith('video/')
                    ? '.mp4'
                    : ''
  return `${base}${ext}`
}
