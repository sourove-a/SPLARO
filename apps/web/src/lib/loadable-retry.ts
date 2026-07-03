/** Detect webpack / Next.js stale chunk errors after HMR or corrupt .next cache. */
export function isChunkLoadError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return (
    err.name === 'ChunkLoadError' ||
    /loading chunk \d+ failed/i.test(err.message) ||
    /chunkloaderror/i.test(err.message)
  )
}

/**
 * Wrap dynamic import() — retry once, then hard-reload to fetch fresh chunks.
 */
export function importWithChunkRetry<T>(loader: () => Promise<T>): () => Promise<T> {
  return async () => {
    try {
      return await loader()
    } catch (first) {
      if (!isChunkLoadError(first)) throw first
      await new Promise((r) => setTimeout(r, 350))
      try {
        return await loader()
      } catch (second) {
        if (!isChunkLoadError(second) || typeof window === 'undefined') throw second
        const key = 'splaro_chunk_reload'
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1')
          window.location.reload()
          await new Promise(() => {})
        }
        sessionStorage.removeItem(key)
        throw second
      }
    }
  }
}
