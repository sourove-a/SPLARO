import { getStorefrontOrigin } from '@/lib/storefront-origin'

/** Resolve upload paths so admin and storefront both display images. */
export function resolveMediaUrl(url: string): string {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  // Root-relative media belongs to storefront, not admin origin. This includes
  // bundled hero defaults under /images as well as uploaded files under /uploads.
  if (url.startsWith('/')) {
    return `${getStorefrontOrigin()}${url}`
  }
  return url
}

export function mediaIdentity(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    return new URL(trimmed, 'https://media.local').pathname.replace(/\/+$/, '') || '/'
  } catch {
    return trimmed.split(/[?#]/, 1)[0]?.replace(/\/+$/, '') || ''
  }
}
