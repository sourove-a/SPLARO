import type { HeroBanner } from '@/lib/api/banners'
import { productSlug } from '@/lib/catalog/index'
import type { StorefrontProduct } from '@/data/storefront'
import { HERO_DEFAULT_SLIDES } from '@splaro/config'
import { preferLocalHeroSrc } from '@/lib/assets/hero-cdn'

/**
 * Curated landscape hero slides — the fallback when admin hasn't configured any
 * Banner rows. Proper 16:9 editorial images (not portrait product shots) and no
 * heavy autoplay video, so the hero stays fast and visually coherent.
 */
export function heroBannersFromDefaults(): HeroBanner[] {
  return HERO_DEFAULT_SLIDES.map((slide, index) => ({
    id: `default-${slide.key}`,
    title: slide.title,
    subtitle: slide.subtitle,
    image: slide.image,
    linkUrl: slide.linkUrl,
    sortOrder: index,
  }))
}

/** Build hero slides from live catalog — last resort when defaults are unavailable. */
export function heroBannersFromCatalog(
  products: (StorefrontProduct & { slug?: string })[],
): HeroBanner[] {
  if (!products.length) return []

  const picks = [
    products.find((p) => p.isBestSeller),
    products.find((p) => p.isNewArrival),
    products[0],
  ].filter(Boolean) as (StorefrontProduct & { slug?: string })[]

  const seen = new Set<string>()
  const unique = picks.filter((p) => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return Boolean(p.image?.trim())
  })

  return unique.slice(0, 3).map((product, index) => ({
    id: `catalog-${product.id}`,
    title: product.name,
    subtitle: product.category ? `${product.category} collection` : 'Shop SPLARO',
    image: product.image,
    linkUrl: `/products/${product.slug ?? productSlug(product)}`,
    sortOrder: index,
  }))
}

function isHeroVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url) || /videos\.pexels\.com\/video-files/i.test(url)
}

/**
 * Force premium light heroes: local WebP when known; never LCP on Pexels UHD
 * video-as-image (DB often stores mp4 in `image`).
 */
function sanitizeHeroBanner(banner: HeroBanner, index: number): HeroBanner {
  const image = banner.image?.trim() || ''
  if (!image) return banner

  if (isHeroVideoUrl(image)) {
    const local =
      HERO_DEFAULT_SLIDES[index % HERO_DEFAULT_SLIDES.length]?.image ??
      HERO_DEFAULT_SLIDES[0]?.image
    return local ? { ...banner, image: local } : banner
  }

  return { ...banner, image: preferLocalHeroSrc(image) }
}

export function resolveHeroBanners(
  apiBanners: HeroBanner[],
  products: (StorefrontProduct & { slug?: string })[],
): HeroBanner[] {
  const fromApi = apiBanners
    .filter((banner) => banner.image?.trim())
    .map((banner, index) => sanitizeHeroBanner(banner, index))
  if (fromApi.length) return fromApi
  // Prefer the curated landscape defaults over cropping portrait product shots
  // into the wide hero — only fall to catalog if defaults somehow yield nothing.
  const defaults = heroBannersFromDefaults()
  if (defaults.length) return defaults
  return heroBannersFromCatalog(products)
}
