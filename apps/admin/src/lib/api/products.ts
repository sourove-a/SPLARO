import { apiFetch, SPLARO_DOMAINS } from './client'

export interface ApiProduct {
  id: string
  name: string
  slug?: string
  sku?: string | null
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
  category?: { id: string; name: string } | null
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

export function fetchProducts(params?: {
  page?: number
  limit?: number
  search?: string
  status?: 'published' | 'draft'
}) {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.search) qs.set('search', params.search)
  if (params?.status) qs.set('status', params.status)
  const query = qs.toString()
  return apiFetch<ProductsListResponse>(`/admin/products${query ? `?${query}` : ''}`)
}

export interface CreateProductInput {
  name: string
  nameBn?: string
  slug?: string
  description?: string
  shortDescription?: string
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
  badge?: string | null
  rmCode?: string | null
  barcode?: string | null
  qrCode?: string | null
  publishAt?: string | null
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

export function deleteProduct(id: string) {
  return apiFetch<{ id: string }>(`/admin/products/${id}`, { method: 'DELETE' })
}

export interface ProductVariantWriteInput {
  stock?: number
  price?: number
  compareAtPrice?: number | null
  isActive?: boolean
  sku?: string
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
