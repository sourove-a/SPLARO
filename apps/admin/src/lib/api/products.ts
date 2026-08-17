import { apiFetch, SPLARO_DOMAINS } from './client'
import type { CatalogUpsertRow } from '@/lib/admin/product-catalog-sheet'

export interface ApiProduct {
  id: string
  name: string
  slug?: string
  sku?: string | null
  /** Permanent six-digit customer-facing Product Code. */
  productCode?: string | null
  /** Category Code frozen into this product's variant SKUs. */
  skuCategoryCode?: string | null
  /** Style serial within that category. */
  skuModelNumber?: number | null
  basePrice: number | string
  compareAtPrice?: number | string | null
  costPrice?: number | string | null
  shortDescription?: string | null
  lowStockThreshold?: number
  tags?: string[]
  schemaMarkup?: Record<string, unknown> | null
  isHidden?: boolean
  isPublished: boolean
  status: string
  description?: string | null
  categoryId?: string | null
  category?: { id: string; name: string; slug?: string } | null
  collections?: { collectionId: string; collection?: { id: string; name: string } }[]
  _count?: { variants: number }
  variants?: {
    id?: string
    stock?: number
    stockQuantity?: number
    reservedStock?: number
    size?: string
    color?: string
    colorName?: string
    colorHex?: string | null
    image?: string | null
    sku?: string | null
    barcode?: string | null
    price?: number | string
    compareAtPrice?: number | string | null
    isActive?: boolean
  }[]
  fabricContent?: string | null
  fitType?: string | null
  occasion?: string | null
  careInstructions?: string | null
  season?: string | null
  metaTitle?: string | null
  metaDescription?: string | null
  isFeatured?: boolean
  isNewArrival?: boolean
  isBestSeller?: boolean
  weight?: number | string | null
  lengthCm?: number | string | null
  widthCm?: number | string | null
  heightCm?: number | string | null
  productType?: string | null
  inventoryPolicy?: 'DENY' | 'CONTINUE' | 'PREORDER'
  preorderReleaseAt?: string | null
  additionalDetails?: Array<{ label: string; value: string }> | null
  origin?: string | null
  badge?: string | null
  rmCode?: string | null
  barcode?: string | null
  qrCode?: string | null
  publishAt?: string | null
  images?: { url: string; altText?: string | null; position?: number; isDefault?: boolean }[]
}

export interface ProductsListResponse {
  products: ApiProduct[]
  total: number
  page: number
  totalPages: number
}

export type ProductListStatus = 'published' | 'draft' | 'out-of-stock'

export function fetchProducts(params?: {
  page?: number
  limit?: number
  search?: string
  status?: ProductListStatus
  sort?: string
}) {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.search) qs.set('search', params.search)
  if (params?.status) qs.set('status', params.status)
  if (params?.sort) qs.set('sort', params.sort)
  const query = qs.toString()
  return apiFetch<ProductsListResponse>(`/admin/products${query ? `?${query}` : ''}`)
}

export interface ProductTranslateResponse {
  nameBn?: string
  descriptionBn?: string
  /** Provider that answered — surfaced so a key problem is diagnosable. */
  model: string
}

/**
 * English product copy → Bangla, via the store's configured AI provider.
 *
 * Replaces the old local template, which produced code-mixed "Banglish"
 * (`refined Men's Shoes যেখানে premium tailoring meets everyday luxury।`)
 * rather than anything a Bangla-speaking customer would read as Bangla.
 */
export function translateProductCopy(input: { name?: string; description?: string }) {
  return apiFetch<ProductTranslateResponse>('/admin/products/translate', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export interface ProductStatsResponse {
  total: number
  published: number
  draft: number
  outOfStock: number
  lowStock: number
}

/**
 * Catalog-wide tallies. The KPI tiles used to count the rows on screen, which
 * the API caps at 100 — so they stopped being true the moment the catalogue
 * outgrew a single page.
 */
export function fetchProductStats(params?: { search?: string }) {
  const qs = new URLSearchParams()
  if (params?.search) qs.set('search', params.search)
  const query = qs.toString()
  return apiFetch<ProductStatsResponse>(`/admin/products/stats${query ? `?${query}` : ''}`)
}

export interface CreateProductInput {
  name: string
  nameBn?: string
  slug?: string
  description?: string
  shortDescription?: string
  /** Bangla copy — stored beside nameBn, kept out of the English description. */
  descriptionBn?: string
  basePrice: number
  compareAtPrice?: number | null
  costPrice?: number
  sku?: string
  lowStockThreshold?: number
  tags?: string[]
  weavingType?: string
  collectionId?: string
  categoryId?: string
  isPublished?: boolean
  isHidden?: boolean
  status?: string
  imageUrl?: string
  imageUrls?: string[]
  videoUrl?: string
  sizes?: string[]
  colors?: Array<string | { name: string; hex: string; image?: string }>
  fabricContent?: string
  fitType?: string
  occasion?: string
  careInstructions?: string
  season?: string
  metaTitle?: string
  metaDescription?: string
  defaultStock?: number
  isFeatured?: boolean
  isNewArrival?: boolean
  isBestSeller?: boolean
  weight?: number | null
  lengthCm?: number | null
  widthCm?: number | null
  heightCm?: number | null
  productType?: string | null
  inventoryPolicy?: 'DENY' | 'CONTINUE' | 'PREORDER'
  preorderReleaseAt?: string | null
  additionalDetails?: Array<{ label: string; value: string }>
  origin?: string | null
  badge?: string | null
  rmCode?: string | null
  barcode?: string | null
  qrCode?: string | null
  publishAt?: string | null
  media?: Array<{
    url: string
    type: 'image' | 'video'
    altText?: string
    isDefault?: boolean
    position?: number
  }>
  variants?: Array<{
    size?: string
    colorName?: string
    colorHex?: string
    image?: string
    sku?: string
    barcode?: string
    price: number
    compareAtPrice?: number | null
    stock: number
    isActive?: boolean
  }>
  /** Skip version snapshot for visibility-only toggles. */
  skipVersionSnapshot?: boolean
}

export function createProduct(input: CreateProductInput) {
  return apiFetch<ApiProduct>('/admin/products', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateProduct(id: string, input: Partial<CreateProductInput>) {
  return apiFetch<ApiProduct>(`/admin/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

/** Archives the product — it leaves the storefront but stays in the books. */
export function deleteProduct(id: string) {
  return apiFetch<{ id: string }>(`/admin/products/${id}`, { method: 'DELETE' })
}

/** Erases the product row. Rejected by the API once it appears on any order. */
export function permanentlyDeleteProduct(id: string) {
  return apiFetch<{ success: boolean; deleted: string }>(`/admin/products/${id}/permanent`, {
    method: 'DELETE',
  })
}

export interface ProductVariantWriteInput {
  stock?: number
  price?: number
  compareAtPrice?: number | null
  isActive?: boolean
  sku?: string
  barcode?: string
  size?: string
  color?: string
  colorName?: string
  colorHex?: string
  image?: string
  stockReason?: string
  stockNote?: string
}

export function updateProductVariant(
  productId: string,
  variantId: string,
  data: ProductVariantWriteInput,
) {
  return apiFetch(`/admin/products/${productId}/variants/${variantId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export interface CreateProductVariantInput {
  size?: string
  color?: string
  colorName?: string
  colorHex?: string
  image?: string
  sku?: string
  barcode?: string
  price: number
  compareAtPrice?: number
  stock?: number
}

export function createProductVariant(productId: string, data: CreateProductVariantInput) {
  return apiFetch(`/admin/products/${productId}/variants`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function archiveProductVariant(productId: string, variantId: string) {
  return apiFetch(`/admin/products/${productId}/variants/${variantId}/archive`, {
    method: 'PATCH',
  })
}

export function deleteProductImage(productId: string, imageId: string) {
  return apiFetch<{ deleted: boolean }>(`/admin/products/${productId}/images/${imageId}`, { method: 'DELETE' })
}

export function addProductImage(
  productId: string,
  data: { url: string; altText?: string; isDefault?: boolean },
) {
  return apiFetch<{ id: string; url: string }>(`/admin/products/${productId}/images`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function fetchProduct(id: string) {
  return apiFetch<ApiProduct>(`/admin/products/${id}`)
}

export function productStatus(product: ApiProduct): 'active' | 'draft' | 'archived' {
  if (product.status === 'ARCHIVED') return 'archived'
  if (!product.isPublished) return 'draft'
  return 'active'
}

export function productStock(product: ApiProduct): number {
  if (product.variants?.length) {
    return product.variants.reduce((sum, v) => sum + (Number((v as { stock?: number }).stock) || 0), 0)
  }
  return 0
}

export function generateProductSkus(id: string) {
  return apiFetch<{ updated: number }>(`/admin/products/${id}/generate-skus`, { method: 'POST' })
}

export function fetchProductQR(id: string, siteUrl = SPLARO_DOMAINS.site.replace(/\/+$/, '')) {
  return apiFetch<{ qr: string }>(`/admin/products/${id}/qr?siteUrl=${encodeURIComponent(siteUrl)}`)
}

export function fetchProductBarcode(id: string, format = 'CODE128') {
  return apiFetch<{ barcode: string }>(
    `/admin/products/${id}/barcode?format=${encodeURIComponent(format)}`,
  )
}

export interface ProductVersionEntry {
  id: string
  version: number
  changedBy: string
  changeNote?: string | null
  createdAt: string
}

export function fetchProductVersions(id: string) {
  return apiFetch<ProductVersionEntry[]>(`/admin/products/${id}/versions`)
}

export function restoreProductVersion(id: string, versionId: string, restoredBy: string) {
  return apiFetch<{ success: boolean }>(`/admin/products/${id}/versions/${versionId}/restore`, {
    method: 'POST',
    body: JSON.stringify({ restoredBy }),
  })
}

export function bulkUpdateStock(updates: { variantId: string; stock: number }[]) {
  return apiFetch<{ updated: number; failed: number }>('/admin/products/bulk/stock', {
    method: 'POST',
    body: JSON.stringify({ updates }),
  })
}

export function bulkPublishProducts(ids: string[], isPublished: boolean) {
  return apiFetch<{ updated: number }>('/admin/products/bulk/publish', {
    method: 'POST',
    body: JSON.stringify({ ids, isPublished }),
  })
}

export function bulkUpdatePrices(
  updates: {
    variantId?: string
    sku?: string
    productId?: string
    price: number
    compareAtPrice?: number | null
  }[],
) {
  return apiFetch<{ updated: number; failed: number; results: { key: string; ok: boolean; error?: string }[] }>(
    '/admin/products/bulk/price',
    {
      method: 'POST',
      body: JSON.stringify({ updates }),
    },
  )
}

export interface CatalogExportRow {
  name: string
  name_bn: string
  product_sku: string
  slug: string
  category: string
  collection: string
  description: string
  description_bn: string
  short_description: string
  base_price: string
  compare_at_price: string
  cost_price: string
  published: string
  featured: string
  new_arrival: string
  best_seller: string
  badge: string
  rm_code: string
  tags: string
  fabric: string
  fit: string
  occasion: string
  season: string
  care: string
  image_url: string
  image_urls: string
  size: string
  color: string
  color_hex: string
  variant_sku: string
  barcode: string
  price: string
  stock: string
  [key: string]: string
}

/** Full-catalog export — no status filter = every product (draft + published). Long timeout for large stores. */
export function fetchProductsExport(params?: { status?: 'published' | 'draft' }) {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  const query = qs.toString()
  return apiFetch<{ rows: CatalogExportRow[]; total: number }>(
    `/admin/products/export${query ? `?${query}` : ''}`,
    { timeoutMs: 120_000 },
  )
}

export function bulkUpsertCatalog(rows: CatalogUpsertRow[]) {
  return apiFetch<{
    created: number
    updated: number
    failed: number
    results: { key: string; ok: boolean; action?: string; error?: string }[]
  }>('/admin/products/bulk/catalog', {
    method: 'POST',
    body: JSON.stringify({ rows }),
    timeoutMs: 120_000,
  })
}
