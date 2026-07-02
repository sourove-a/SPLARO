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
    sku?: string | null
    price?: number | string
    isActive?: boolean
  }[]
  fabricContent?: string | null
  fitType?: string | null
  occasion?: string | null
  season?: string | null
  metaTitle?: string | null
  metaDescription?: string | null
  isFeatured?: boolean
  isNewArrival?: boolean
  isBestSeller?: boolean
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
  season?: string
  metaTitle?: string
  metaDescription?: string
  defaultStock?: number
  isFeatured?: boolean
  isNewArrival?: boolean
  isBestSeller?: boolean
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

export function updateProductVariant(
  productId: string,
  variantId: string,
  data: { stock?: number; price?: number; isActive?: boolean },
) {
  return apiFetch(`/admin/products/${productId}/variants/${variantId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
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
