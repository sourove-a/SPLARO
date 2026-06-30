import { apiFetch, getStoreId } from './client'

export interface PosVariant {
  id: string
  sku: string | null
  barcode: string | null
  size: string | null
  color: string | null
  colorHex: string | null
  price: number
  stock: number
  image: string | null
}

export interface PosProduct {
  id: string
  name: string
  sku: string | null
  image: string | null
  basePrice: number
  variants: PosVariant[]
}

export interface PosCatalogResponse {
  products: PosProduct[]
  matchedVariantId: string | null
}

export interface PosTodayStats {
  count: number
  total: number
  byMethod: Record<string, number>
  date: string
}

export interface PosSaleResult {
  order: {
    id: string
    invoiceNumber: string
    total: number
    paymentMethod: string
    items: { id: string; name: string; variant: string | null; quantity: number; price: number }[]
  }
}

export type PosPaymentMethod = 'cash' | 'bkash' | 'nagad' | 'card'

export function fetchPosCatalog(params?: { q?: string; sku?: string }) {
  const qs = new URLSearchParams({ storeId: getStoreId() })
  if (params?.q) qs.set('q', params.q)
  if (params?.sku) qs.set('sku', params.sku)
  return apiFetch<PosCatalogResponse>(`/admin/pos/catalog?${qs}`)
}

export function fetchPosToday() {
  return apiFetch<PosTodayStats>(`/admin/pos/today?storeId=${encodeURIComponent(getStoreId())}`)
}

export function createPosSale(input: {
  items: { productId: string; variantId: string; quantity: number }[]
  paymentMethod: PosPaymentMethod
  customerName?: string
  customerPhone?: string
  discount?: number
  notes?: string
  staffName?: string
}) {
  return apiFetch<PosSaleResult>(`/admin/pos/sale?storeId=${encodeURIComponent(getStoreId())}`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
