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

/** Only used if even the curated Unsplash defaults below fail to load. */
const HERO_PLACEHOLDER = '/images/placeholder-product.jpg'

// Curated editorial photos shown when the admin hasn't added real hero banners
// yet (empty/fresh catalog) — a plain dark gradient here reads as "the site is
// broken" to a first-time visitor, so these stand in until real ones exist.
export const HERO_DEFAULT_SLIDES: HeroDefaultSlide[] = [
  {
    key: 'women-collection',
    eyebrow: 'SPLARO WOMEN COLLECTION',
    title: 'Elegance That Moves With You.',
    subtitle: 'Premium fashion crafted for timeless everyday luxury.',
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d',
    linkUrl: '/shop',
    secondaryLinkUrl: '/collections',
  },
  {
    key: 'summer',
    eyebrow: 'SUMMER EDITION — 2026',
    title: 'Dress the warmth.',
    subtitle: 'Light fabrics, golden hours, effortless grace.',
    image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b',
    linkUrl: '/c/summer-edition',
    secondaryLinkUrl: '/new-arrivals',
  },
  {
    key: 'new-season',
    eyebrow: 'NEW SEASON',
    title: 'Refined silhouettes.',
    subtitle: 'Editorial pieces for every occasion.',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b',
    linkUrl: '/c/women',
    secondaryLinkUrl: '/collections',
  },
]
