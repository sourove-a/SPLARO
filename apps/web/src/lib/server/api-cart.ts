import { getApiBaseUrl } from '@splaro/config'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

function apiUrl(path: string): string {
  const base = getApiBaseUrl()
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export async function fetchCartFromApi(sessionId: string): Promise<Response> {
  return fetch(
    apiUrl(
      `/storefront/cart/${encodeURIComponent(sessionId)}?storeId=${encodeURIComponent(STORE_ID)}`,
    ),
    { cache: 'no-store' },
  )
}

export async function clearCartOnApi(sessionId: string): Promise<Response> {
  return fetch(
    apiUrl(
      `/storefront/cart/${encodeURIComponent(sessionId)}/clear?storeId=${encodeURIComponent(STORE_ID)}`,
    ),
    { method: 'POST', cache: 'no-store' },
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
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    },
  )
}
