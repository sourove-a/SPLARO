const LOCAL_EARTH_BASE = '/images/earth'

export const EARTH_TEXTURE_URLS = {
  day: `${LOCAL_EARTH_BASE}/earth-day.webp`,
  night: `${LOCAL_EARTH_BASE}/earth-night.webp`,
  bump: `${LOCAL_EARTH_BASE}/earth-bump.webp`,
  clouds: `${LOCAL_EARTH_BASE}/earth-clouds.webp`,
  moon: `${LOCAL_EARTH_BASE}/moon.webp`,
} as const

let texturePreloadPromise: Promise<void> | null = null
let fullPreloadPromise: Promise<void> | null = null

function warmImageCache() {
  for (const url of Object.values(EARTH_TEXTURE_URLS)) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.src = url
  }
}

/** Lightweight — image cache only, no Three.js chunk. */
export function preloadEarthTextures(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (texturePreloadPromise) return texturePreloadPromise

  texturePreloadPromise = (async () => {
    warmImageCache()

    const { TextureLoader } = await import('three')
    const loader = new TextureLoader()
    loader.setCrossOrigin('anonymous')

    await Promise.all(
      Object.values(EARTH_TEXTURE_URLS).map(
        (url) =>
          new Promise<void>((resolve) => {
            loader.load(url, () => resolve(), undefined, () => resolve())
          }),
      ),
    )
  })()

  return texturePreloadPromise
}

/** Preload earth textures via Three loader — for footer earth on non-home pages. */
export function preloadFooterEarthAssets(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (fullPreloadPromise) return fullPreloadPromise

  fullPreloadPromise = preloadEarthTextures()
  return fullPreloadPromise
}
