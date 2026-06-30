/** Default homepage hero slides when no Banner rows exist in the database. */
export const HERO_DEFAULT_VIDEO =
  'https://videos.pexels.com/video-files/1409899/1409899-uhd_2560_1440_25fps.mp4'

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

export const HERO_DEFAULT_SLIDES: HeroDefaultSlide[] = [
  {
    key: 'women-collection',
    eyebrow: 'SPLARO WOMEN COLLECTION',
    title: 'Elegance That Moves With You.',
    subtitle: 'Premium fashion crafted for timeless everyday luxury.',
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e',
    video: HERO_DEFAULT_VIDEO,
    linkUrl: '/shop',
    secondaryLinkUrl: '/collections',
  },
  {
    key: 'summer',
    eyebrow: 'SUMMER EDITION — 2026',
    title: 'Dress the warmth.',
    subtitle: 'Light fabrics, golden hours, effortless grace.',
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d',
    linkUrl: '/c/summer-edition',
    secondaryLinkUrl: '/new-arrivals',
  },
  {
    key: 'new-season',
    eyebrow: 'NEW SEASON',
    title: 'Refined silhouettes.',
    subtitle: 'Editorial pieces for every occasion.',
    image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b',
    linkUrl: '/c/women',
    secondaryLinkUrl: '/collections',
  },
]
