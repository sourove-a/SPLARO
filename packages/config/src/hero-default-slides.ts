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

const HERO_PLACEHOLDER = '/images/placeholder-product.jpg'

export const HERO_DEFAULT_SLIDES: HeroDefaultSlide[] = [
  {
    key: 'women-collection',
    eyebrow: 'SPLARO WOMEN COLLECTION',
    title: 'Elegance That Moves With You.',
    subtitle: 'Premium fashion crafted for timeless everyday luxury.',
    image: HERO_PLACEHOLDER,
    linkUrl: '/shop',
    secondaryLinkUrl: '/collections',
  },
  {
    key: 'summer',
    eyebrow: 'SUMMER EDITION — 2026',
    title: 'Dress the warmth.',
    subtitle: 'Light fabrics, golden hours, effortless grace.',
    image: HERO_PLACEHOLDER,
    linkUrl: '/c/summer-edition',
    secondaryLinkUrl: '/new-arrivals',
  },
  {
    key: 'new-season',
    eyebrow: 'NEW SEASON',
    title: 'Refined silhouettes.',
    subtitle: 'Editorial pieces for every occasion.',
    image: HERO_PLACEHOLDER,
    linkUrl: '/c/women',
    secondaryLinkUrl: '/collections',
  },
]
