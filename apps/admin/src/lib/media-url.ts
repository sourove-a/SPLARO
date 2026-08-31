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

/**
 * Photos a media picker must not offer: the ones already in this product's
 * slots, plus — unless the operator asked to see used photos — every photo the
 * rest of the catalogue points at. Unlinking a photo drops it from both lists,
 * so it becomes selectable again.
 */
export function hiddenMediaKeys(
  ownUrls: readonly string[],
  usedUrls: readonly string[],
  showUsed: boolean,
): Set<string> {
  const keys = new Set<string>()
  const add = (value: string) => {
    const key = mediaIdentity(value)
    if (key) keys.add(key)
  }
  for (const url of ownUrls) add(url)
  if (!showUsed) {
    for (const url of usedUrls) add(url)
  }
  return keys
}
