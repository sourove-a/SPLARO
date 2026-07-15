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
   *  Keep ILYN-range q=65–80 for heroes; cards stay sharper (86). */
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
  card: 900,
  cardMobile: 480,
  gallery: 1200,
  galleryMobile: 828,
  hero: 1600,
  heroMobile: 828,
  thumb: 160,
  lightbox: 1600,
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

/** Normalize remote URLs for sharper, lighter delivery. Local `/uploads` paths pass through for Next optimizer. */
export function optimizeImageSrc(
  url: string | null | undefined,
  profile: ImageProfile = 'card',
  fallback: string = PRODUCT_IMAGE_PLACEHOLDER,
  opts?: { allowStockMedia?: boolean },
): string {
  const sanitized = sanitizeRemoteImageUrl(url, fallback, opts)
  if (!sanitized || sanitized.startsWith('/') || sanitized.startsWith('data:')) {
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
