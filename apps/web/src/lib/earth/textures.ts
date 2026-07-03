const LOCAL_EARTH_BASE = '/images/earth'

export const EARTH_TEXTURE_URLS = {
  day: `${LOCAL_EARTH_BASE}/earth-day.jpg`,
  night: `${LOCAL_EARTH_BASE}/earth-night.jpg`,
  bump: `${LOCAL_EARTH_BASE}/earth-bump.png`,
  clouds: `${LOCAL_EARTH_BASE}/earth-clouds.png`,
  moon: `${LOCAL_EARTH_BASE}/moon.jpg`,
} as const

let preloadPromise: Promise<void> | null = null

function warmImageCache() {
  for (const url of Object.values(EARTH_TEXTURE_URLS)) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.src = url
  }
}

/** Preload earth textures + Three chunk so footer globe spins smoothly on first paint. */
export function preloadFooterEarthAssets(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (preloadPromise) return preloadPromise

  preloadPromise = (async () => {
    warmImageCache()

    const [{ TextureLoader }, { EarthGlobe }] = await Promise.all([
      import('three'),
      import('@/components/earth/EarthGlobe'),
    ])

    void EarthGlobe

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

  return preloadPromise
}
