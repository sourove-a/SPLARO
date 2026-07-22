import { getStorefrontOrigin } from '@/lib/storefront-origin'

/** Resolve upload paths so admin and storefront both display images. */
export function resolveMediaUrl(url: string): string {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/uploads/')) {
    return `${getStorefrontOrigin()}${url}`
  }
  return url
}
