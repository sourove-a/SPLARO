import {
  colorGroup,
  isStorefrontBestSeller,
  isStorefrontNewArrival,
  products,
  slugFromCategory,
  type StorefrontProduct,
  type StorefrontVariantRef,
} from '@/data/storefront'
import type {
  ColorOption,
  ProductCardData,
  ProductDetailData,
  ProductVariantData,
} from '@splaro/types'

/** Bundled demo catalog — dev-only; never customer-facing in production. */
export function staticCatalogEnabled(): boolean {
  return process.env.NODE_ENV === 'development'
}

function bundledProducts(): StorefrontProduct[] {
  return staticCatalogEnabled() ? products : []
}

export function productSlug(product: Pick<StorefrontProduct, 'id' | 'name'>): string {
  const base = product.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${base}-${product.id.replace(/^sp-/, '')}`
}

function colorOptions(product: StorefrontProduct): ColorOption[] {
  return product.colors.map((hex) => ({
    hex,
    name: colorGroup(hex),
  }))
}

export function variantId(productId: string, size: string, colorHex: string): string {
  return `${productId}__${size}__${colorHex.replace('#', '')}`
}

/**
 * Resolve a REAL database variant for quick-add buttons.
 * Never fabricate variant ids — the API rejects unknown ids on cart sync
 * and order placement. Returns null when the product has no live variants
 * (in that case omit variantId and let the API resolve by size/color).
 */
export function resolveQuickAddVariant(
  product: Pick<StorefrontProduct, 'variantRefs'>,
  size?: string,
  colorHex?: string,
): StorefrontVariantRef | null {
  const refs = (product.variantRefs ?? []).filter((ref) => ref.isActive)
  if (!refs.length) return null

  const hex = colorHex?.toLowerCase()
  const matches = (ref: StorefrontVariantRef, checkSize: boolean, checkColor: boolean) =>
    (!checkSize || !size || ref.size === size) &&
    (!checkColor || !hex || ref.colorHex === hex)

  return (
    refs.find((ref) => ref.stock > 0 && matches(ref, true, true)) ??
    refs.find((ref) => matches(ref, true, true)) ??
    refs.find((ref) => ref.stock > 0 && matches(ref, true, false)) ??
    refs.find((ref) => ref.stock > 0) ??
    refs[0] ??
    null
  )
}

/** Dev-only variant synthesis for bundled catalog fixtures. */
export function generateVariants(product: StorefrontProduct): ProductVariantData[] {
  if (!staticCatalogEnabled()) return []

  const variants: ProductVariantData[] = []

  for (const size of product.sizes) {
    for (const colorHex of product.colors) {
      const id = variantId(product.id, size, colorHex)
      variants.push({
        id,
        size,
        color: colorHex,
        colorHex,
        colorName: colorGroup(colorHex),
        price: product.price,
        stock: 0,
        image: product.image,
        isActive: true,
      })
    }
  }

  return variants
}

export function isStorefrontProductInStock(product: StorefrontProduct): boolean {
  if (typeof product.inStock === 'boolean') return product.inStock
  if (product.variantRefs?.length) {
    return product.variantRefs.some((ref) => ref.isActive && ref.stock > 0)
  }
  return false
}

export function getStockForVariant(
  productId: string,
  _size: string,
  _colorHex: string,
  stockOverlay?: Record<string, number>,
): number {
  if (stockOverlay) {
    const id = variantId(productId, _size, _colorHex)
    if (id in stockOverlay) return stockOverlay[id] ?? 0
  }
  return 0
}

function baseCardFields(product: StorefrontProduct): ProductCardData {
  const slug = productSlug(product)
  const rating = Number(product.rating ?? 0)
  const reviewCount = Number(product.reviewCount ?? 0)

  return {
    id: product.id,
    slug,
    name: product.name,
    price: product.price,
    images: [product.image, product.hoverImage],
    colorOptions: colorOptions(product),
    isNewArrival: isStorefrontNewArrival(product),
    isBestSeller: isStorefrontBestSeller(product),
    isOnSale: Boolean(product.compareAtPrice && product.compareAtPrice > product.price),
    rating: rating > 0 && reviewCount > 0 ? rating : 0,
    reviewCount: reviewCount > 0 ? reviewCount : 0,
    category: product.category,
    collectionSlug: slugFromCategory(product.category),
  }
}

export function toProductCard(product: StorefrontProduct): ProductCardData {
  return baseCardFields(product)
}

export function toProductDetail(product: StorefrontProduct): ProductDetailData {
  const card = baseCardFields(product)

  return {
    ...card,
    description: `${product.name} is crafted from ${product.material.toLowerCase()} with a ${product.fit.toLowerCase()} fit. Designed for everyday SPLARO wear with refined finishing and breathable comfort.`,
    shortDescription: `${product.fit} fit · ${product.material}`,
    sku: product.code,
    fabricContent: product.material,
    careInstructions: 'Machine wash cold · Do not bleach · Line dry in shade',
    origin: 'Bangladesh',
    variants: generateVariants(product),
    tags: [product.category, product.status, product.fit],
    metaTitle: product.name,
    metaDescription: `Shop ${product.name} at SPLARO. ${product.material}, ${product.fit} fit. Price in BDT ${product.price.toLocaleString('en-BD')}.`,
  }
}

export function getAllProducts(): ProductCardData[] {
  return bundledProducts().map(toProductCard)
}

export function getAllProductSlugs(): Array<{ slug: string }> {
  return bundledProducts().map((product) => ({ slug: productSlug(product) }))
}

export const catalog: ProductDetailData[] = bundledProducts().map(toProductDetail)

export function getProductById(id: string): ProductDetailData | null {
  const product = bundledProducts().find((entry) => entry.id === id)
  return product ? toProductDetail(product) : null
}

export function getProductBySlug(slug: string): ProductDetailData | null {
  const product = bundledProducts().find(
    (entry) => productSlug(entry) === slug || entry.id === slug,
  )
  return product ? toProductDetail(product) : null
}

export function searchProducts(q: string): ProductCardData[] {
  const query = q.trim().toLowerCase()
  const source = bundledProducts()
  if (!query) return source.map(toProductCard)

  return source
    .filter((product) => {
      const slug = productSlug(product)
      return (
        product.name.toLowerCase().includes(query) ||
        product.code.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query) ||
        product.material.toLowerCase().includes(query) ||
        slug.includes(query) ||
        product.id.toLowerCase().includes(query)
      )
    })
    .map(toProductCard)
}
