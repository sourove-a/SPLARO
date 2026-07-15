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
 */
export const HERO_DEFAULT_SLIDES: HeroDefaultSlide[] = [
  {
    key: 'women-collection',
    eyebrow: 'SPLARO',
    title: 'Elegance That Moves With You.',
    subtitle: 'Premium fashion crafted for timeless everyday luxury.',
    image: '/images/hero/women-collection-1600.webp',
    linkUrl: '/shop',
    secondaryLinkUrl: '/collections',
  },
  {
    key: 'summer',
    eyebrow: 'SPLARO',
    title: 'Dress the warmth.',
    subtitle: 'Light fabrics, golden hours, effortless grace.',
    image: '/images/hero/summer-1600.webp',
    linkUrl: '/c/summer-edition',
    secondaryLinkUrl: '/new-arrivals',
  },
  {
    key: 'new-season',
    eyebrow: 'SPLARO',
    title: 'Refined silhouettes.',
    subtitle: 'Editorial pieces for every occasion.',
    image: '/images/hero/new-season-1600.webp',
    linkUrl: '/c/women',
    secondaryLinkUrl: '/collections',
  },
]
