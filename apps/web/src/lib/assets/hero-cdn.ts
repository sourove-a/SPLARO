/**
 * Self-hosted hero WebPs under `/images/hero/` (ILYN-style: origin/CDN static,
 * not hotlinked Unsplash @1920). Mobile/desktop variants for LCP.
 */

export type HeroLocalVariants = {
  desktop: string
  mobile: string
}

const HERO_LOCAL_BY_KEY: Record<string, HeroLocalVariants> = {
  'women-collection': {
    desktop: '/images/hero/women-collection-1600.webp',
    mobile: '/images/hero/women-collection-828.webp',
  },
  summer: {
    desktop: '/images/hero/summer-1600.webp',
    mobile: '/images/hero/summer-828.webp',
  },
  'new-season': {
    desktop: '/images/hero/new-season-1600.webp',
    mobile: '/images/hero/new-season-828.webp',
  },
}

/** Legacy Unsplash IDs → local CDN files (defaults + old admin banners). */
const UNSPLASH_TO_KEY: Record<string, keyof typeof HERO_LOCAL_BY_KEY> = {
  'photo-1490481651871-ab68de25d43d': 'women-collection',
  'photo-1469334031218-e382a71b716b': 'summer',
  'photo-1483985988355-763728e1935b': 'new-season',
}

export function resolveLocalHeroVariants(src: string | null | undefined): HeroLocalVariants | null {
  const trimmed = src?.trim() ?? ''
  if (!trimmed) return null

  const byPath = trimmed.match(/\/images\/hero\/([a-z0-9-]+?)(?:-1600|-828)?\.webp(?:\?|$)/i)
  if (byPath?.[1] && HERO_LOCAL_BY_KEY[byPath[1]]) {
    return HERO_LOCAL_BY_KEY[byPath[1]]!
  }

  for (const [id, key] of Object.entries(UNSPLASH_TO_KEY)) {
    if (trimmed.includes(id)) return HERO_LOCAL_BY_KEY[key]!
  }

  return null
}

/** Prefer local desktop WebP path for slide data / SSR poster fields. */
export function preferLocalHeroSrc(src: string): string {
  return resolveLocalHeroVariants(src)?.desktop ?? src
}
