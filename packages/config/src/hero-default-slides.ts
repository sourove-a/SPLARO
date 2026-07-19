/** Default homepage hero slides when no Banner rows exist in the database. */
export const HERO_DEFAULT_VIDEO = ''
export const HERO_DEFAULT_VIDEO_MOBILE = ''

export interface HeroDefaultSlide {
  key: string
  eyebrow: string
  title: string
  subtitle: string
  image: string
  video?: string
  linkUrl: string
  secondaryLinkUrl: string
}

/**
 * Self-hosted WebP heroes (`apps/web/public/images/hero/*`) — same-origin / CDN cache,
 * ~50–60KB desktop / ~18KB mobile. Do not point defaults at Unsplash @1920 (slow LCP).
 *
 * Keep slides women-fashion only — streetwear / men / kids heroes dilute SPLARO identity.
 */
export const HERO_DEFAULT_SLIDES: HeroDefaultSlide[] = [
  {
    key: 'women-collection',
    eyebrow: 'SPLARO',
    title: 'Quiet luxury, for her.',
    subtitle: 'Refined silhouettes and soft fabrics for everyday elegance.',
    image: '/images/hero/women-collection-1600.webp',
    linkUrl: '/c/women',
    secondaryLinkUrl: '/new-arrivals',
  },
  {
    key: 'new-season',
    eyebrow: 'SPLARO',
    title: 'The season edit.',
    subtitle: 'Editorial pieces for the modern wardrobe.',
    image: '/images/hero/new-season-1600.webp',
    linkUrl: '/new-arrivals',
    secondaryLinkUrl: '/c/women',
  },
]
