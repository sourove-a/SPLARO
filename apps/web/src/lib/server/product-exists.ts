import { getServerApiBaseUrl } from '@splaro/config/domains'
import { fetchWithTimeout } from '@/lib/server/build-safe-fetch'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'
const CACHE_MS = 30_000
const TIMEOUT_MS = 900

type CacheEntry = { exists: boolean; expiresAt: number }

const cache = new Map<string, CacheEntry>()

/**
 * Fast existence probe for middleware — real HTTP 404 when Next soft-200s
 * streamed notFound() shells. Fail-open (null) on timeout so live PDPs never
 * break if API is briefly slow.
 */
export async function productSlugExists(slug: string): Promise<boolean | null> {
  const key = slug.trim().toLowerCase()
  if (!key || key.length > 160) return false

  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expiresAt > now) return hit.exists

  try {
    const res = await fetchWithTimeout(
      `${getServerApiBaseUrl()}/storefront/products/${encodeURIComponent(key)}?storeId=${encodeURIComponent(STORE_ID)}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        timeoutMs: TIMEOUT_MS,
      },
    )
    if (!res) return null
    if (res.status === 404) {
      cache.set(key, { exists: false, expiresAt: now + CACHE_MS })
      return false
    }
    if (!res.ok) return null
    cache.set(key, { exists: true, expiresAt: now + CACHE_MS })
    return true
  } catch {
    return null
  }
}
