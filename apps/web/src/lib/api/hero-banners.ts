import type { HeroBanner } from '@/lib/api/banners'
import { canonicalizeHeroMediaUrl, isHeroVideoUrl } from '@splaro/config'
import { preferLocalHeroSrc } from '@/lib/assets/hero-cdn'

function sanitizeHeroBanner(banner: HeroBanner): HeroBanner {
  const image = canonicalizeHeroMediaUrl(banner.image?.trim() || '')
  if (!image) return banner
  const withCanonical = image === banner.image ? banner : { ...banner, image }
  if (isHeroVideoUrl(image)) return withCanonical
  return { ...withCanonical, image: preferLocalHeroSrc(image) }
}

export function resolveHeroBanners(apiBanners: HeroBanner[]): HeroBanner[] {
  return apiBanners
    .filter((banner) => banner.image?.trim())
    .map((banner) => sanitizeHeroBanner(banner))
}

/** Merchant copy only — never invent SPLARO / luxury fallback lines. */
export function heroSlideCopy(banner: Pick<HeroBanner, 'title' | 'subtitle' | 'linkUrl'>) {
  return {
    title: banner.title?.trim() ?? '',
    subtitle: banner.subtitle?.trim() ?? '',
    href: banner.linkUrl?.trim() ?? '',
  }
}
