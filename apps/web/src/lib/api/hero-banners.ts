import type { HeroBanner } from '@/lib/api/banners'
import { HERO_DEFAULT_SLIDES, canonicalizeHeroMediaUrl, isHeroVideoUrl } from '@splaro/config'
import { preferLocalHeroSrc } from '@/lib/assets/hero-cdn'

/** Local WebP posters only — never used as fake live slides. */
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

export function resolveHeroBanners(apiBanners: HeroBanner[]): HeroBanner[] {
  return apiBanners
    .filter((banner) => banner.image?.trim())
    .map((banner, index) => sanitizeHeroBanner(banner, index, { allowVideo: true }))
}
