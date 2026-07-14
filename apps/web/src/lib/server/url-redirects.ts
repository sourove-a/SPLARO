import { getServerApiBaseUrl } from '@splaro/config'
import { fetchWithTimeout } from '@/lib/server/build-safe-fetch'
import { upstreamFetchTimeoutMs } from '@/lib/server/fetch-timeouts'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'
const CACHE_MS = 60_000

export interface StorefrontRedirect {
  fromPath: string
  toPath: string
  type: string
}

type RedirectCache = {
  expiresAt: number
  rules: StorefrontRedirect[]
}

let cache: RedirectCache | null = null

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.replace(/\/+$/, '')
  }
  return pathname
}

export async function getStorefrontRedirects(): Promise<StorefrontRedirect[]> {
  const now = Date.now()
  if (cache && cache.expiresAt > now) return cache.rules

  try {
    const res = await fetchWithTimeout(
      `${getServerApiBaseUrl()}/storefront/redirects?storeId=${encodeURIComponent(STORE_ID)}`,
      { next: { revalidate: 60 }, timeoutMs: upstreamFetchTimeoutMs() },
    )
    if (!res || !res.ok) return cache?.rules ?? []
    const data = (await res.json()) as { redirects?: StorefrontRedirect[] }
    const rules = data.redirects ?? []
    cache = { rules, expiresAt: now + CACHE_MS }
    return rules
  } catch {
    return cache?.rules ?? []
  }
}

export function matchRedirect(pathname: string, rules: StorefrontRedirect[]): StorefrontRedirect | null {
  const normalized = normalizePath(pathname)
  return rules.find((rule) => normalizePath(rule.fromPath) === normalized) ?? null
}

export function redirectStatusCode(type: string): number {
  if (type === '302' || type === '307') return 302
  return 301
}
