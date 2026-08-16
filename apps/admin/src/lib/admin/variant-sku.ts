import { buildVariantSku, categoryIsSizeless } from '@splaro/config'

import { apiFetch } from '@/lib/api/client'

export interface SkuIdentity {
  categoryCode: string
  modelNumber: number
  /** True when the product already owns this model number (edit), false for a create preview. */
  exact: boolean
}

/**
 * Ask the API which SPL-{CAT}-{MODEL} the next product in this category will
 * get. Read-only — opening the form never consumes a model number, so the
 * preview may shift by one if a colleague saves first. The stored SKU is always
 * minted server-side on save.
 */
export function fetchSkuIdentity(params: { categoryId?: string; productId?: string }) {
  const query = new URLSearchParams()
  if (params.categoryId) query.set('categoryId', params.categoryId)
  if (params.productId) query.set('productId', params.productId)
  const suffix = query.toString()
  return apiFetch<SkuIdentity>(`/admin/products/sku-preview${suffix ? `?${suffix}` : ''}`)
}

/**
 * Live SKU for one variant. Same builder the API uses, so what the operator
 * sees in the form is what gets stored.
 */
export function previewVariantSku(
  identity: SkuIdentity | null | undefined,
  variant: { color?: string | null; size?: string | null },
): string {
  if (!identity) return ''
  return buildVariantSku({
    category: identity.categoryCode,
    model: identity.modelNumber,
    color: variant.color ?? null,
    size: variant.size ?? null,
  })
}

export { categoryIsSizeless }
