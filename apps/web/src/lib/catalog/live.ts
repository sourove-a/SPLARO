import { getServerApiBaseUrl } from '@splaro/config'
import { slugFromCategory } from '@/data/storefront'
import type { ColorOption, StorefrontProduct } from '@/data/storefront'
import type { ProductDetailData, ProductVariantData } from '@splaro/types'
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import { sanitizeRemoteImageUrl } from '@/lib/assets/images'
import {
  sanitizeStorefrontDescription,
  sanitizeStorefrontProductCode,
  sanitizeStorefrontShortDescription,
} from '@/lib/catalog/storefront-sanitize'
import {
  LISTING_PAGE_SIZE,
  type StorefrontListingQuery,
} from '@/lib/catalog/listing'
import { fetchWithTimeout, isCiOrProductionBuild } from '@/lib/server/build-safe-fetch'
import { catalogFetchAttempts, catalogFetchTimeoutMs } from '@/lib/server/fetch-timeouts'
import { resolveShopCategory } from '@/lib/catalog/shop-category'
import { pageTitleSegment } from '@/lib/seo/page-title'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

function liveFetch(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  return fetchWithTimeout(url, { timeoutMs: catalogFetchTimeoutMs(), ...init })
}

export interface ProductReview {
  id: string
  name: string
  rating: number
  text: string
  title?: string
  verified?: boolean
  helpfulCount?: number
  adminReply?: string
  adminReplyAt?: string
  createdAt?: string
}

interface LiveVariant {
  id?: string
  size?: string | null
  color?: string | null
  colorHex?: string | null
  colorName?: string | null
  stock: number
  price: number | string
  compareAtPrice?: number | string | null
  image?: string | null
  isActive?: boolean
}

interface LiveReview {
  id?: string
  rating: number
  title?: string | null
  body?: string | null
  verifiedPurchase?: boolean
  helpfulCount?: number
  adminReply?: string | null
  adminReplyAt?: string
  createdAt?: string
  customer?: { firstName: string; lastName: string } | null
}

interface LiveProduct {
  id: string
  name: string
  slug: string
  sku?: string | null
  description?: string | null
  shortDescription?: string | null
  basePrice: number | string
  compareAtPrice?: number | string | null
  fabricContent?: string | null
  careInstructions?: string | null
  fitType?: string | null
  occasion?: string | null
  season?: string | null
  origin?: string | null
  tags?: string[]
  metaTitle?: string | null
  metaDescription?: string | null
  rating?: number | string
  reviewCount?: number
  isNewArrival?: boolean
  isBestSeller?: boolean
  schemaMarkup?: Record<string, unknown> | null
  isOnSale?: boolean
  category?: { name: string; slug?: string } | null
  images?: { url: string; altText?: string | null; position?: number | null }[]
  variants?: LiveVariant[]
  reviews?: LiveReview[]
}

function isVideoMedia(image?: { url?: string | null; altText?: string | null }) {
  const url = image?.url ?? ''
  return image?.altText === 'media:video' || /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url)
}

function productMedia(images: LiveProduct['images']) {
  return (images ?? [])
    .map((image) => ({
      type: isVideoMedia(image) ? 'video' as const : 'image' as const,
      url: image.url,
      ...(image.altText ? { alt: image.altText } : {}),
    }))
    .filter((media) => Boolean(media.url))
}

const HEX_COLOR_NAMES: Record<string, string> = {
  '#f2f0e8': 'Ivory',
  '#b8c6bd': 'Sage',
  '#111111': 'Black',
  '#121212': 'Onyx',
  '#222222': 'Charcoal',
  '#d8d6ce': 'Sand',
  '#1f2a2e': 'Deep Navy',
  '#253036': 'Forest',
  '#f6d6d2': 'Blush',
  '#ece7dd': 'Oat',
  '#f7c9d7': 'Rose',
  '#8dc7c8': 'Aqua',
  '#f1c34b': 'Sun',
  '#f5f5f0': 'Cloud',
  '#c9c1b5': 'Stone',
  '#f6efe5': 'Cream',
  '#d7bca2': 'Camel',
  '#dad6cc': 'Mist',
  '#e9d4ef': 'Lilac',
  '#f0b350': 'Amber',
  '#8fbfc6': 'Sky',
  '#dc2626': 'Red',
  '#ffffff': 'White',
}

function labelFromHex(hex: string) {
  return HEX_COLOR_NAMES[hex.toLowerCase()] ?? 'Selected'
}

function buildColorOptions(variants: LiveVariant[], fallbackImg: string): ColorOption[] {
  const map = new Map<string, ColorOption>()

  for (const variant of variants) {
    const hex = (variant.colorHex ?? '#111111').toLowerCase()
    const name =
      variant.colorName?.trim() ||
      (variant.color && variant.color !== 'Default' ? variant.color : null) ||
      labelFromHex(hex)

    if (!map.has(hex)) {
      map.set(hex, {
        id: hex,
        hex,
        name,
        image: variant.image ?? fallbackImg,
      })
    }
  }

  return [...map.values()]
}

export function sortSizes(sizes: string[], categoryName?: string | null) {
  const footwear = categoryName?.toLowerCase() === 'footwear'
  const numeric = sizes.every((size) => /^\d+$/.test(size))

  if (footwear || numeric) {
    return [...sizes].sort((a, b) => Number(a) - Number(b))
  }

  const order = ['XS', 'S', 'M', 'L', 'XL', '2Y', '4Y', '6Y', '8Y', '10Y', '12Y', '14Y']
  return [...sizes].sort((a, b) => {
    const ai = order.indexOf(a)
    const bi = order.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}


function mapReviews(reviews: LiveReview[] | undefined): ProductReview[] {
  return (reviews ?? []).map((review, index) => {
    const name = review.customer
      ? `${review.customer.firstName} ${review.customer.lastName.charAt(0)}.`.trim()
      : 'Verified buyer'
    return {
      id: review.id ?? `review-${index}`,
      name,
      rating: review.rating,
      text: review.body?.trim() || review.title?.trim() || '',
      ...(review.title?.trim() ? { title: review.title.trim() } : {}),
      ...(review.verifiedPurchase ? { verified: true } : {}),
      ...(review.helpfulCount != null ? { helpfulCount: review.helpfulCount } : {}),
      ...(review.adminReply?.trim() ? { adminReply: review.adminReply.trim() } : {}),
      ...(review.adminReplyAt ? { adminReplyAt: review.adminReplyAt } : {}),
      ...(review.createdAt ? { createdAt: review.createdAt } : {}),
    }
  }).filter((review) => review.text.length > 0)
}

function buildVariants(p: LiveProduct, basePrice: number, fallbackImg: string): ProductVariantData[] {
  const variants = p.variants ?? []
  if (!variants.length) {
    return [{
      id: p.id,
      price: basePrice,
      stock: 0,
      image: fallbackImg,
      isActive: true,
    }]
  }

  return variants.map((variant) => {
    const hex = (variant.colorHex ?? '#111111').toLowerCase()
    const colorName =
      variant.colorName?.trim() ||
      (variant.color && variant.color !== 'Default' ? variant.color : null) ||
      labelFromHex(hex)

    const row: ProductVariantData = {
      id: variant.id ?? `${p.id}-${variant.size ?? 'one'}-${hex.replace('#', '')}`,
      price: Number(variant.price ?? basePrice),
      stock: Number(variant.stock ?? 0),
      isActive: variant.isActive !== false,
    }
    if (variant.size) row.size = variant.size
    if (hex) row.colorHex = hex
    if (colorName) {
      row.color = colorName
      row.colorName = colorName
    }
    if (variant.image ?? fallbackImg) row.image = variant.image ?? fallbackImg
    if (variant.compareAtPrice != null) row.compareAtPrice = Number(variant.compareAtPrice)
    return row
  })
}

export function mapLiveProduct(
  p: LiveProduct,
): StorefrontProduct & { slug: string; categorySlug?: string; categoryName?: string } {
  const variants = p.variants ?? []
  const media = productMedia(p.images)
  const imageMedia = media.filter((item) => item.type === 'image')
  const img = sanitizeRemoteImageUrl(imageMedia[0]?.url, PRODUCT_IMAGE_PLACEHOLDER)
  const hover = sanitizeRemoteImageUrl(imageMedia[1]?.url, img)
  const category = resolveShopCategory(p.category?.name, p.category?.slug)
  const colorOptions = buildColorOptions(variants, img)
  const colors = colorOptions.map((option) => option.hex)
  const rawSizes = [...new Set(variants.map((v) => v.size).filter(Boolean))] as string[]
  const activeStock = variants
    .filter((v) => v.isActive !== false)
    .reduce((sum, v) => sum + Number(v.stock ?? 0), 0)

  const variantRefs = variants
    .filter((v): v is LiveVariant & { id: string } => Boolean(v.id))
    .map((v) => ({
      id: v.id,
      ...(v.size ? { size: v.size } : {}),
      ...(v.colorHex ? { colorHex: v.colorHex.toLowerCase() } : {}),
      stock: Number(v.stock ?? 0),
      isActive: v.isActive !== false,
    }))

  const mappedReviews = mapReviews(p.reviews)
  const apiRating = Number(p.rating ?? 0)
  const apiReviewCount = p.reviewCount ?? mappedReviews.length
  const rating =
    apiRating > 0
      ? apiRating
      : mappedReviews.length
        ? mappedReviews.reduce((sum, review) => sum + review.rating, 0) / mappedReviews.length
        : 0
  const reviewCount = apiReviewCount > 0 ? apiReviewCount : mappedReviews.length

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    code: sanitizeStorefrontProductCode(p.sku, p.slug) ?? '',
    category,
    ...(p.category?.slug ? { categorySlug: p.category.slug } : {}),
    ...(p.category?.name ? { categoryName: p.category.name } : {}),
    price: Number(p.basePrice),
    ...(p.compareAtPrice != null ? { compareAtPrice: Number(p.compareAtPrice) } : {}),
    colors,
    ...(colorOptions.length ? { colorOptions } : {}),
    // Never invent M/L or shoe sizes — unsized products stay size-free.
    sizes: rawSizes.length ? sortSizes(rawSizes, category) : [],
    inStock: activeStock > 0,
    status: p.isNewArrival ? 'New' : p.isBestSeller ? 'Limited' : 'Ready',
    isNewArrival: Boolean(p.isNewArrival),
    isBestSeller: Boolean(p.isBestSeller),
    image: img,
    hoverImage: hover,
    ...(media.length ? { media } : {}),
    fit: p.fitType ?? 'Regular',
    material: p.fabricContent ?? 'Premium fabric',
    ...(variantRefs.length ? { variantRefs } : {}),
    ...(rating > 0 && reviewCount > 0 ? { rating, reviewCount } : {}),
  }
}

export function mapLiveProductDetail(p: LiveProduct): { product: ProductDetailData; reviews: ProductReview[] } {
  const mapped = mapLiveProduct(p)
  const media = productMedia(p.images)
  const imageMedia = media.filter((item) => item.type === 'image')
  const img = sanitizeRemoteImageUrl(imageMedia[0]?.url, PRODUCT_IMAGE_PLACEHOLDER)
  const hover = sanitizeRemoteImageUrl(imageMedia[1]?.url, img)
  const images = (
    imageMedia.length
      ? imageMedia.map((image) => sanitizeRemoteImageUrl(image.url))
      : [img, hover]
  ).filter(Boolean)
  const category = resolveShopCategory(p.category?.name, p.category?.slug)
  const colorOptions = buildColorOptions(p.variants ?? [], img).map(({ hex, name }) => ({ hex, name }))
  const reviews = mapReviews(p.reviews)
  const apiRating = Number(p.rating ?? 0)
  const rating =
    apiRating > 0
      ? apiRating
      : reviews.length
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
        : 0
  const reviewCount = (p.reviewCount ?? 0) > 0 ? (p.reviewCount ?? reviews.length) : reviews.length

  const schema = (p.schemaMarkup && typeof p.schemaMarkup === 'object' && !Array.isArray(p.schemaMarkup))
    ? p.schemaMarkup as Record<string, unknown>
    : {}
  const nameBn = typeof schema.nameBn === 'string' ? schema.nameBn : undefined
  const weavingType = typeof schema.weavingType === 'string' ? schema.weavingType : undefined
  const publicSku = sanitizeStorefrontProductCode(p.sku, p.slug)

  const product: ProductDetailData = {
    id: mapped.id,
    slug: p.slug,
    name: p.name,
    ...(nameBn ? { nameBn } : {}),
    price: Number(p.basePrice),
    ...(p.compareAtPrice != null ? { compareAtPrice: Number(p.compareAtPrice) } : {}),
    images,
    ...(media.length ? { media } : {}),
    ...(colorOptions.length ? { colorOptions } : {}),
    isNewArrival: Boolean(p.isNewArrival),
    isBestSeller: Boolean(p.isBestSeller),
    isOnSale: Boolean(p.isOnSale),
    rating: rating > 0 && reviewCount > 0 ? rating : 0,
    reviewCount: reviewCount > 0 ? reviewCount : 0,
    category,
    ...(p.category?.slug ? { categorySlug: p.category.slug } : {}),
    collectionSlug: slugFromCategory(category),
    description: sanitizeStorefrontDescription(
      p.description,
      `${p.name} is crafted with ${(p.fabricContent ?? 'premium fabric').toLowerCase()} and a ${(p.fitType ?? 'regular').toLowerCase()} fit.`,
    ),
    ...(() => {
      const short = sanitizeStorefrontShortDescription(p.shortDescription)
      return short ? { shortDescription: short } : {}
    })(),
    ...(publicSku ? { sku: publicSku } : {}),
    ...(p.fabricContent ? { fabricContent: p.fabricContent } : {}),
    ...(weavingType ? { weavingType } : {}),
    ...(p.careInstructions ? { careInstructions: p.careInstructions } : {}),
    ...(p.fitType ? { fitType: p.fitType } : {}),
    ...(p.occasion ? { occasion: p.occasion } : {}),
    ...(p.season ? { season: p.season } : {}),
    origin: p.origin ?? 'Bangladesh',
    variants: buildVariants(p, Number(p.basePrice), img),
    tags: p.tags?.length ? p.tags : [category],
    metaTitle: pageTitleSegment(p.metaTitle) || p.name,
    metaDescription:
      p.metaDescription ??
      `Shop ${p.name} at SPLARO. Price in BDT ${Number(p.basePrice).toLocaleString('en-BD')}.`,
  }

  return { product, reviews }
}

export async function fetchLiveProductsRaw(): Promise<(StorefrontProduct & { slug: string })[]> {
  if (isCiOrProductionBuild()) return []

  const base = getServerApiBaseUrl()
  const url = `${base}/storefront/products?storeId=${encodeURIComponent(STORE_ID)}`
  const attempts = catalogFetchAttempts()

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await liveFetch(url, { cache: 'no-store' })
      if (!res?.ok) throw new Error(`Storefront API ${res?.status ?? 'unavailable'}`)
      const data = (await res.json()) as { products: LiveProduct[] }
      // Show all published API rows — DEMO SKU/copy is sanitized in mapLiveProduct.
      // Hard-filtering demos emptied production when the DB only had seed inventory.
      return (data.products ?? []).map(mapLiveProduct)
    } catch (err) {
      if (attempt === attempts - 1) throw err
    }
  }

  return []
}

export async function fetchLiveProducts(): Promise<(StorefrontProduct & { slug: string })[]> {
  return fetchLiveProductsRaw()
}

export async function fetchProductsByIds(ids: string[]): Promise<(StorefrontProduct & { slug: string })[]> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return []

  const base = getServerApiBaseUrl()
  const url = `${base}/storefront/products?storeId=${encodeURIComponent(STORE_ID)}&ids=${encodeURIComponent(unique.join(','))}`
  const res = await liveFetch(url, { cache: 'no-store' })
  if (!res?.ok) return []
  const data = (await res.json()) as { products: LiveProduct[] }
  return (data.products ?? []).map(mapLiveProduct)
}

export async function fetchLiveProductDetailBySlug(
  slug: string,
): Promise<{ product: ProductDetailData; reviews: ProductReview[] } | null> {
  const base = getServerApiBaseUrl()
  const url = `${base}/storefront/products/${encodeURIComponent(slug)}?storeId=${encodeURIComponent(STORE_ID)}`
  const res = await liveFetch(url, { next: { revalidate: 15 } })
  if (!res) throw new Error(`Product API unavailable for ${slug}`)
  // Only a real 404 means "product does not exist" — any other failure must throw
  // so callers don't turn a transient API outage into a permanent not-found page.
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Product API responded ${res.status} for ${slug}`)
  const data = (await res.json()) as { product: LiveProduct | null }
  return data.product ? mapLiveProductDetail(data.product) : null
}

export type CatalogProduct = StorefrontProduct & {
  slug: string
  categorySlug?: string
  categoryName?: string
}

interface ProductsApiResponse {
  products: LiveProduct[]
  total: number
  page?: number
  totalPages?: number
}

function mapProductsResponse(data: ProductsApiResponse) {
  const products = (data.products ?? []).map(mapLiveProduct)
  return {
    products,
    total: data.total ?? products.length,
    totalPages: data.totalPages ?? 1,
    page: data.page ?? 1,
  }
}

export async function fetchStorefrontProductListing(
  query: StorefrontListingQuery = {},
): Promise<{
  products: CatalogProduct[]
  total: number
  totalPages: number
  page: number
}> {
  const base = getServerApiBaseUrl()
  const params = new URLSearchParams({
    storeId: STORE_ID,
    page: String(query.page ?? 1),
    limit: String(query.limit ?? LISTING_PAGE_SIZE),
  })

  if (query.collectionSlug ?? query.collection) {
    params.set('collectionSlug', query.collectionSlug ?? query.collection ?? '')
  }
  if (query.categorySlug ?? query.category) {
    params.set('categorySlug', query.categorySlug ?? query.category ?? '')
  }
  if (query.parentCategorySlug) {
    params.set('parentCategorySlug', query.parentCategorySlug)
  }

  try {
    const res = await liveFetch(`${base}/storefront/products?${params}`, {
      next: { revalidate: 15, tags: ['storefront-products'] },
    })
    if (!res?.ok) return { products: [], total: 0, totalPages: 0, page: 1 }
    const data = (await res.json()) as ProductsApiResponse
    const mapped = mapProductsResponse(data)
    return {
      products: mapped.products,
      total: mapped.total,
      totalPages: mapped.totalPages,
      page: mapped.page,
    }
  } catch {
    return { products: [], total: 0, totalPages: 0, page: 1 }
  }
}

export async function fetchLiveCollections(): Promise<
  Array<{
    id: string
    name: string
    slug: string
    productCount: number
    imageUrl?: string | null
  }>
> {
  if (isCiOrProductionBuild()) return []

  const base = getServerApiBaseUrl()
  const url = `${base}/storefront/collections?storeId=${encodeURIComponent(STORE_ID)}`

  try {
    const res = await liveFetch(url, { next: { revalidate: 120 } })
    if (!res?.ok) return []
    const data = (await res.json()) as {
      collections?: Array<{
        id: string
        name: string
        slug: string
        imageUrl?: string | null
        _count?: { products?: number }
      }>
    }
    return (data.collections ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      productCount: row._count?.products ?? 0,
      imageUrl: row.imageUrl ?? null,
    }))
  } catch {
    return []
  }
}

export async function fetchProductsByCategory(
  categorySlug: string,
  page = 1,
  limit = 40,
): Promise<{ products: CatalogProduct[]; total: number; totalPages: number }> {
  const base = getServerApiBaseUrl()
  const params = new URLSearchParams({
    storeId: STORE_ID,
    categorySlug,
    page: String(page),
    limit: String(limit),
  })

  try {
    const res = await liveFetch(`${base}/storefront/products?${params}`, {
      next: { revalidate: 15, tags: [`products-${categorySlug}`] },
    })
    if (!res?.ok) return { products: [], total: 0, totalPages: 0 }
    const data = (await res.json()) as ProductsApiResponse
    const mapped = mapProductsResponse(data)
    return {
      products: mapped.products,
      total: mapped.total,
      totalPages: mapped.totalPages,
    }
  } catch {
    return { products: [], total: 0, totalPages: 0 }
  }
}

export async function fetchAllAccessories(): Promise<{
  products: CatalogProduct[]
  total: number
}> {
  const base = getServerApiBaseUrl()

  async function load(params: URLSearchParams) {
    const res = await liveFetch(`${base}/storefront/products?${params}`, {
      next: { revalidate: 15, tags: ['products-accessories'] },
    })
    if (!res?.ok) return { products: [] as CatalogProduct[], total: 0 }
    const data = (await res.json()) as ProductsApiResponse
    const mapped = mapProductsResponse(data)
    return { products: mapped.products, total: mapped.total }
  }

  const collectionParams = new URLSearchParams({
    storeId: STORE_ID,
    collectionSlug: 'accessories',
    limit: '80',
    page: '1',
  })

  try {
    const fromCollection = await load(collectionParams)
    if (fromCollection.products.length > 0) return fromCollection

    const parentParams = new URLSearchParams({
      storeId: STORE_ID,
      parentCategorySlug: 'accessories',
      limit: '80',
      page: '1',
    })
    return await load(parentParams)
  } catch {
    return { products: [], total: 0 }
  }
}

export async function fetchCustomerProfile(phone: string) {
  const base = getServerApiBaseUrl()
  const url = `${base}/storefront/customer/profile?storeId=${encodeURIComponent(STORE_ID)}&phone=${encodeURIComponent(phone)}`
  const res = await liveFetch(url, { cache: 'no-store' })
  if (!res?.ok) return null
  const data = (await res.json()) as {
    customer: {
      loyaltyPoints: number
      loyaltyTier: string
      totalOrders: number
      createdAt: string
    } | null
  }
  return data.customer
}
