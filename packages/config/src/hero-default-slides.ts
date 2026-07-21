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
 * Brand direction: modern Bangladesh lifestyle — men, women & kids (not women-only).
 */
export const HERO_DEFAULT_SLIDES: HeroDefaultSlide[] = [
  {
    key: 'lifestyle-edit',
    eyebrow: 'SPLARO',
    title: 'Quiet luxury, every day.',
    subtitle: 'Men, women & kids — refined pieces for modern Bangladesh.',
    image: '/images/hero/women-collection-1600.webp',
    linkUrl: '/shop',
    secondaryLinkUrl: '/new-arrivals',
  },
  {
    key: 'new-season',
    eyebrow: 'SPLARO',
    title: 'The season edit.',
    subtitle: 'New arrivals across apparel, footwear, and accessories.',
    image: '/images/hero/new-season-1600.webp',
    linkUrl: '/new-arrivals',
    secondaryLinkUrl: '/shop',
  },
]
