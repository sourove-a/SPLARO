import { apiFetch } from './client'

export type PosPaymentMethod = 'cash' | 'bkash' | 'nagad' | 'card'

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
  barcode: string | null
  image: string | null
  basePrice: number
  variants: PosVariant[]
}

export interface PosCatalogResponse {
  products: PosProduct[]
  /** Set when a barcode/SKU scan resolved to exactly one variant. */
  matchedVariantId: string | null
}

export interface PosTodayStats {
  total: number
  count: number
  [key: string]: unknown
}

export interface PosSaleResponse {
  order: {
    id: string
    invoiceNumber: string
    total: number
    paymentMethod: string
    items: { id: string; name: string; variant: string | null; quantity: number; price: number }[]
  }
}

export function searchPosCatalog(params: { q?: string; sku?: string }) {
  const qs = new URLSearchParams()
  if (params.q?.trim()) qs.set('q', params.q.trim())
  if (params.sku?.trim()) qs.set('sku', params.sku.trim())
  const suffix = qs.toString()
  return apiFetch<PosCatalogResponse>(`/admin/pos/catalog${suffix ? `?${suffix}` : ''}`)
}

export function fetchPosToday() {
  return apiFetch<PosTodayStats>('/admin/pos/today')
}

export function createPosSale(body: {
  items: { productId: string; variantId: string; quantity: number }[]
  paymentMethod: PosPaymentMethod
  customerName?: string
  customerPhone?: string
  discount?: number
  notes?: string
  staffName?: string
}) {
  return apiFetch<PosSaleResponse>('/admin/pos/sale', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
