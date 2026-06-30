import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import { optimizeImageSrc } from '@/lib/assets/image-optimize'

/** Known dead Unsplash IDs in legacy seed/content data. */
const BROKEN_IMAGE_REWRITES: Array<{ match: string; replacement: string }> = [
  {
    match: 'photo-1610030469983-98e550d619fa',
    replacement:
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=900&h=1200&q=88&fit=crop',
  },
  {
    match: 'photo-1483985988-d82da5fd0168',
    replacement:
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=700&h=700&q=88&auto=format&fit=crop',
  },
]

export function sanitizeRemoteImageUrl(
  url: string | null | undefined,
  fallback: string = PRODUCT_IMAGE_PLACEHOLDER,
): string {
  const trimmed = url?.trim() ?? ''
  if (!trimmed) return fallback

  for (const { match, replacement } of BROKEN_IMAGE_REWRITES) {
    if (trimmed.includes(match)) return replacement
  }

  return trimmed
}

export function sanitizeStorefrontProduct<T extends { image: string; hoverImage?: string }>(
  product: T,
): T {
  const image = optimizeImageSrc(sanitizeRemoteImageUrl(product.image), 'card')
  const hoverImage = optimizeImageSrc(
    sanitizeRemoteImageUrl(product.hoverImage ?? product.image, image),
    'card',
  )
  return { ...product, image, hoverImage }
}
