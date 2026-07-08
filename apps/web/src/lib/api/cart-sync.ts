import type { CartItem } from '@/store/cartStore'
import { sanitizeRemoteImageUrl } from '@/lib/assets/images'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'
const CART_SYNC_TIMEOUT_MS =
  Number(process.env.SPLARO_CART_SYNC_TIMEOUT_MS) > 0
    ? Number(process.env.SPLARO_CART_SYNC_TIMEOUT_MS)
    : process.env.NODE_ENV === 'development'
      ? 4000
      : 8000

function cartFetchInit(init: RequestInit = {}): RequestInit {
  return { ...init, signal: AbortSignal.timeout(CART_SYNC_TIMEOUT_MS) }
}

export type CartSyncResult = { ok: true } | { ok: false; error: string }

function cartApiPath(sessionId: string, suffix = ''): string {
  const base = `/api/cart/${encodeURIComponent(sessionId)}${suffix}`
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}storeId=${encodeURIComponent(STORE_ID)}`
}

function cartSyncError(res: Response | null, fallback: string): string {
  if (res?.status === 503) {
    return 'Cart sync is offline — start the API server (pnpm dev:api) or check API_URL.'
  }
  if (res?.status === 500) {
    return 'Cart sync failed — database connection issue on the server. Cart is saved on this device only.'
  }
  return fallback
}

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
  const image = sanitizeRemoteImageUrl(images[0]?.url)

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
): Promise<CartSyncResult> {
  const sessionId = cartSessionId()
  if (!sessionId) return { ok: true }

  try {
    const res = await fetch(cartApiPath(sessionId), cartFetchInit({ cache: 'no-store', credentials: 'include' }))
    if (!res.ok) {
      return {
        ok: false,
        error: cartSyncError(
          res,
          'Could not load your cart from the server. Your device cart is still saved locally.',
        ),
      }
    }

    const payload = (await res.json()) as {
      cart?: { items?: Record<string, unknown>[] }
    }
    const items = (payload.cart?.items ?? [])
      .map(mapApiCartItem)
      .filter((item): item is CartItem => item !== null)

    if (items.length) merge(items)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Cart sync is offline — your cart is saved on this device only.' }
  }
}

export async function clearServerCart(): Promise<CartSyncResult> {
  const sessionId = cartSessionId()
  if (!sessionId) return { ok: true }

  try {
    const res = await fetch(cartApiPath(sessionId, '/clear'), cartFetchInit({
      method: 'POST',
      credentials: 'include',
    }))
    if (!res.ok) {
      return { ok: false, error: cartSyncError(res, 'Could not clear server cart.') }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Cart sync is offline.' }
  }
}

export async function pushCartToServer(items: CartItem[]): Promise<CartSyncResult> {
  const sessionId = cartSessionId()
  if (!sessionId) return { ok: true }

  // Atomic replace on the server (single PUT in one DB transaction) — the
  // old clear-then-add flow could wipe the server cart and then fail
  // half-way, losing items.
  try {
    const res = await fetch(cartApiPath(sessionId), cartFetchInit({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        items: items.map((item) => ({
          productId: item.productId,
          ...(item.variantId ? { variantId: item.variantId } : {}),
          quantity: item.quantity,
        })),
      }),
    }))
    if (!res.ok) {
      return {
        ok: false,
        error: cartSyncError(
          res,
          'Could not sync cart to server — changes are saved on this device only.',
        ),
      }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Cart sync is offline — changes are saved on this device only.' }
  }
}
