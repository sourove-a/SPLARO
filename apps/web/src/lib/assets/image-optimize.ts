import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import { sanitizeRemoteImageUrl } from '@/lib/assets/images'

/** Warm neutral blur — smooth load before image paints */
export const IMAGE_BLUR_PLACEHOLDER =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k='

export const IMAGE_QUALITY = {
  card: 86,
  cardMobile: 82,
  gallery: 90,
  galleryMobile: 86,
  /** Was 92 @1920 — LCP killer on Contabo (Next image optimizer off).
   *  Keep preferred q=65–80 for heroes; cards stay sharper (86). */
  hero: 80,
  heroMobile: 72,
  thumb: 82,
  lightbox: 92,
} as const

export const IMAGE_SIZES = {
  card: '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',
  cardMobile: '(max-width: 640px) 50vw, 33vw',
  gallery: '(max-width: 1024px) 100vw, 55vw',
  galleryMobile: '100vw',
  hero: '100vw',
  heroMobile: '100vw',
  thumb: '72px',
  collection: '(max-width: 768px) 50vw, 25vw',
  lightbox: 'min(100vw, 1400px)',
} as const

export type ImageProfile = keyof typeof IMAGE_QUALITY

const REMOTE_WIDTH: Record<ImageProfile, number> = {
  // Shop grid renders cards ~286-396px (4-col, max-width 1720px) — 720 covers
  // 2x DPI at typical widths without re-fetching a near-full 900-1000px photo.
  card: 720,
  cardMobile: 480,
  gallery: 1200,
  galleryMobile: 828,
  hero: 1600,
  heroMobile: 828,
  thumb: 160,
  lightbox: 1600,
}

/** Prebuilt product pipeline widths (admin upload). */
const PRODUCT_VARIANT_WIDTH: Record<ImageProfile, number> = {
  thumb: 160,
  cardMobile: 480,
  card: 828,
  galleryMobile: 828,
  gallery: 1200,
  heroMobile: 828,
  hero: 1600,
  lightbox: 1600,
}

const PRODUCT_VARIANT_RE =
  /\/uploads\/products\/([^/]+)\.w(\d+)\.(webp|avif)(?:\?.*)?$/i

function productPipelinePathOnly(url: string): string {
  if (!url.startsWith('http')) return url
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

/**
 * Map `/uploads/products/{id}.w1200.webp` → sibling size for the render profile.
 * Legacy single-file uploads (no `.wN.`) pass through unchanged.
 */
export function pickProductUploadVariant(
  url: string,
  profile: ImageProfile = 'card',
  format: 'webp' | 'avif' = 'webp',
): string {
  const match = productPipelinePathOnly(url).match(PRODUCT_VARIANT_RE)
  if (!match) return url
  const id = match[1]
  const target = PRODUCT_VARIANT_WIDTH[profile] ?? 1200
  return `/uploads/products/${id}.w${target}.${format}`
}

/** True when URL is a Phase-1 product pipeline variant (webp/avif sized file). */
export function isProductPipelineSrc(url: string | null | undefined): boolean {
  if (!url) return false
  return PRODUCT_VARIANT_RE.test(productPipelinePathOnly(url))
}

/** WebP + optional AVIF sibling for `<picture>` on the storefront. */
export function productPipelinePictureSources(
  url: string,
  profile: ImageProfile = 'card',
): { webp: string; avif: string } {
  return {
    webp: pickProductUploadVariant(url, profile, 'webp'),
    avif: pickProductUploadVariant(url, profile, 'avif'),
  }
}

export function mobileImageProfile(profile: ImageProfile): ImageProfile {
  if (profile === 'hero') return 'heroMobile'
  if (profile === 'card') return 'cardMobile'
  if (profile === 'gallery') return 'galleryMobile'
  return profile
}

function isOptimizableRemote(url: string): boolean {
  return (
    url.includes('images.unsplash.com') ||
    url.includes('cdn.splaro.com') ||
    url.includes('placehold.co')
  )
}

/** Normalize remote URLs for sharper, lighter delivery. Local product pipeline picks sibling sizes. */
export function optimizeImageSrc(
  url: string | null | undefined,
  profile: ImageProfile = 'card',
  fallback: string = PRODUCT_IMAGE_PLACEHOLDER,
  opts?: { allowStockMedia?: boolean },
): string {
  const sanitized = sanitizeRemoteImageUrl(url, fallback, opts)
  if (!sanitized) return sanitized

  // Product pipeline variants — works for absolute or path-only URLs.
  const pathOnly = productPipelinePathOnly(sanitized)

  if (PRODUCT_VARIANT_RE.test(pathOnly)) {
    return pickProductUploadVariant(pathOnly, profile, 'webp')
  }

  if (sanitized.startsWith('/') || sanitized.startsWith('data:')) {
    return sanitized
  }

  const width = REMOTE_WIDTH[profile]
  const quality = IMAGE_QUALITY[profile]

  // Aarong media CDN: request only the width we render instead of the stored 1920px original.
  if (sanitized.includes('media.aarong.com')) {
    try {
      const parsed = new URL(sanitized)
      parsed.searchParams.set('width', String(width))
      parsed.searchParams.set('height', '')
      parsed.searchParams.set('optimize', 'high')
      return parsed.toString()
    } catch {
      return sanitized
    }
  }

  if (!isOptimizableRemote(sanitized)) return sanitized

  const base = sanitized.split('?')[0]!
  return `${base}?w=${width}&q=${quality}&auto=format&fit=max`
}
