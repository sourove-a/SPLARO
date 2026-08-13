import type { HeroBanner } from '@/lib/api/banners'
import { productSlug } from '@/lib/catalog/index'
import type { StorefrontProduct } from '@/data/storefront'
import { HERO_DEFAULT_SLIDES, canonicalizeHeroMediaUrl, isHeroVideoUrl } from '@splaro/config'
import { preferLocalHeroSrc } from '@/lib/assets/hero-cdn'

/**
 * Curated landscape hero slides — the fallback when admin hasn't configured any
 * Banner rows. Proper 16:9 editorial images (not portrait product shots) and no
 * heavy autoplay video, so the hero stays fast and visually coherent.
 */
export function heroBannersFromDefaults(): HeroBanner[] {
  return HERO_DEFAULT_SLIDES.map((slide, index) =>
    sanitizeHeroBanner(
      {
        id: `default-${slide.key}`,
        title: slide.title,
        subtitle: slide.subtitle,
        image: slide.image,
        linkUrl: slide.linkUrl,
        sortOrder: index,
      },
      index,
    ),
  )
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

/** Remap retired women-only default hero copy → family lifestyle positioning. */
function alignHeroBrandCopy(banner: HeroBanner): HeroBanner {
  const title = banner.title?.trim() ?? ''
  const subtitle = banner.subtitle?.trim() ?? ''
  let next = banner

  if (/quiet luxury,\s*for her\.?/i.test(title)) {
    next = {
      ...next,
      title: 'Quiet luxury, every day.',
      subtitle: 'Men, women & kids — refined pieces for modern Bangladesh.',
      ...(next.linkUrl === '/c/women' || !next.linkUrl ? { linkUrl: '/shop' } : {}),
    }
  } else if (
    /editorial pieces for the modern wardrobe/i.test(subtitle) &&
    /season edit/i.test(title)
  ) {
    next = {
      ...next,
      subtitle: 'New arrivals across apparel, footwear, and accessories.',
      ...(next.linkUrl === '/c/women' ? { linkUrl: '/shop' } : {}),
    }
  }

  if (/for the modern woman/i.test(next.subtitle ?? '')) {
    next = {
      ...next,
      subtitle: (next.subtitle ?? '').replace(
        /for the modern woman/gi,
        'for modern Bangladesh',
      ),
    }
  }

  return next
}

function sanitizeHeroBanner(
  banner: HeroBanner,
  index: number,
  options?: { allowVideo?: boolean },
): HeroBanner {
  const aligned = alignHeroBrandCopy(banner)
  const image = canonicalizeHeroMediaUrl(aligned.image?.trim() || '')
  if (!image) return aligned
  const withCanonical = image === aligned.image ? aligned : { ...aligned, image }

  if (isHeroVideoUrl(image)) {
    // Keep the URL the merchant pasted (YouTube / Vimeo / mp4 / Pexels). HeroSlider
    // plays SD-first and falls back to poster if the clip stalls.
    if (options?.allowVideo) return withCanonical
    const local =
      HERO_DEFAULT_SLIDES[index % HERO_DEFAULT_SLIDES.length]?.image ??
      HERO_DEFAULT_SLIDES[0]?.image
    return local ? { ...withCanonical, image: local } : withCanonical
  }

  return { ...withCanonical, image: preferLocalHeroSrc(image) }
}

export function resolveHeroBanners(
  apiBanners: HeroBanner[],
  products: (StorefrontProduct & { slug?: string })[],
): HeroBanner[] {
  const fromApi = apiBanners
    .filter((banner) => banner.image?.trim())
    .map((banner, index) => sanitizeHeroBanner(banner, index, { allowVideo: true }))
  if (fromApi.length) return fromApi
  // Prefer the curated landscape defaults over cropping portrait product shots
  // into the wide hero — only fall to catalog if defaults somehow yield nothing.
  const defaults = heroBannersFromDefaults()
  if (defaults.length) return defaults
  return heroBannersFromCatalog(products)
}
