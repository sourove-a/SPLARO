import { getServerApiBaseUrl } from '@splaro/config'

import { upstreamFetchTimeoutMs } from '@/lib/server/fetch-timeouts'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

function upstreamInit(init: RequestInit = {}): RequestInit {
  return { ...init, signal: AbortSignal.timeout(upstreamFetchTimeoutMs()) }
}

function apiUrl(path: string): string {
  const base = getServerApiBaseUrl()
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export async function fetchCartFromApi(sessionId: string): Promise<Response> {
  return fetch(
    apiUrl(
      `/storefront/cart/${encodeURIComponent(sessionId)}?storeId=${encodeURIComponent(STORE_ID)}`,
    ),
    upstreamInit({ cache: 'no-store' }),
  )
}

export async function clearCartOnApi(sessionId: string): Promise<Response> {
  return fetch(
    apiUrl(
      `/storefront/cart/${encodeURIComponent(sessionId)}/clear?storeId=${encodeURIComponent(STORE_ID)}`,
    ),
    upstreamInit({ method: 'POST', cache: 'no-store' }),
  )
}

export async function replaceCartOnApi(
  sessionId: string,
  items: {
    productId: string
    variantId?: string
    size?: string
    color?: string
    quantity: number
  }[],
): Promise<Response> {
  return fetch(
    apiUrl(
      `/storefront/cart/${encodeURIComponent(sessionId)}?storeId=${encodeURIComponent(STORE_ID)}`,
    ),
    upstreamInit({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
      cache: 'no-store',
    }),
  )
}

export async function addCartItemOnApi(
  sessionId: string,
  body: { productId: string; variantId?: string; quantity: number },
): Promise<Response> {
  return fetch(
    apiUrl(
      `/storefront/cart/${encodeURIComponent(sessionId)}/items?storeId=${encodeURIComponent(STORE_ID)}`,
    ),
    upstreamInit({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    }),
  )
}
