import { getApiBaseUrl } from '@splaro/config'
import type { CartItem } from '@/store/cartStore'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

function cartSessionId(): string {
  if (typeof window === 'undefined') return ''
  const key = 'splaro-cart-session'
  let id = window.localStorage.getItem(key)
  if (!id) {
    id = `cart_${crypto.randomUUID().replace(/-/g, '')}`
    window.localStorage.setItem(key, id)
  }
  return id
}

function mapApiCartItem(raw: Record<string, unknown>): CartItem | null {
  const product = raw.product as Record<string, unknown> | undefined
  const variant = raw.variant as Record<string, unknown> | undefined
  const productId = String(raw.productId ?? product?.id ?? '')
  if (!productId) return null

  const images = (product?.images as { url?: string }[] | undefined) ?? []
  const image = images[0]?.url ?? ''

  const item: CartItem = {
    productId,
    quantity: Number(raw.quantity ?? 1),
    name: String(product?.name ?? 'Product'),
    price: Number(variant?.price ?? product?.basePrice ?? 0),
    image,
    slug: String(product?.slug ?? productId),
  }
  const variantId = raw.variantId ? String(raw.variantId) : variant?.id ? String(variant.id) : undefined
  if (variantId) item.variantId = variantId
  if (variant?.size) item.size = String(variant.size)
  if (variant?.color) item.color = String(variant.color)
  return item
}

export async function pullServerCart(
  merge: (items: CartItem[]) => void,
): Promise<void> {
  const sessionId = cartSessionId()
  if (!sessionId) return

  const base = getApiBaseUrl()
  const res = await fetch(
    `${base}/storefront/cart/${encodeURIComponent(sessionId)}?storeId=${encodeURIComponent(STORE_ID)}`,
    { cache: 'no-store' },
  )
  if (!res.ok) return

  const payload = (await res.json()) as {
    cart?: { items?: Record<string, unknown>[] }
  }
  const items = (payload.cart?.items ?? [])
    .map(mapApiCartItem)
    .filter((item): item is CartItem => item !== null)

  if (items.length) merge(items)
}

export async function clearServerCart(): Promise<void> {
  const sessionId = cartSessionId()
  if (!sessionId) return

  const base = getApiBaseUrl()
  await fetch(
    `${base}/storefront/cart/${encodeURIComponent(sessionId)}/clear?storeId=${encodeURIComponent(STORE_ID)}`,
    { method: 'POST' },
  ).catch(() => undefined)
}

export async function pushCartToServer(items: CartItem[]): Promise<void> {
  const sessionId = cartSessionId()
  if (!sessionId) return

  const base = getApiBaseUrl()
  await clearServerCart()

  if (!items.length) return

  for (const item of items) {
    await fetch(
      `${base}/storefront/cart/${encodeURIComponent(sessionId)}/items?storeId=${encodeURIComponent(STORE_ID)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        }),
      },
    ).catch(() => undefined)
  }
}
