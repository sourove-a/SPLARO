import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import { resolveStorefrontAssetUrl } from '@/lib/assets/resolve-asset-url'
import { optimizeImageSrc } from '@/lib/assets/image-optimize'

const REMOTE_STOCK_MEDIA = /images\.unsplash\.com|images\.pexels\.com|videos\.pexels\.com/i

export function sanitizeRemoteImageUrl(
  url: string | null | undefined,
  fallback: string = PRODUCT_IMAGE_PLACEHOLDER,
  opts?: { allowStockMedia?: boolean },
): string {
  const trimmed = url?.trim() ?? ''
  if (!trimmed) return fallback

  const resolved = resolveStorefrontAssetUrl(trimmed)
  // Allow Unsplash/Pexels stills for seeded catalog + editorial heroes so
  // production doesn't replace real product photos with the empty-state tile.
  // Pass allowStockMedia:false only when you must force a non-stock asset.
  if (opts?.allowStockMedia === false && REMOTE_STOCK_MEDIA.test(resolved)) {
    return fallback
  }

  return resolved
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
