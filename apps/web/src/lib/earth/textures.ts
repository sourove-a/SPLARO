export const EARTH_TEXTURE_URLS = {
  day: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg',
  night: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg',
  bump: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png',
  clouds:
    'https://raw.githubusercontent.com/vasturiano/three-globe/master/example/clouds/clouds.png',
  moon: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r149/examples/textures/planets/moon_1024.jpg',
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
