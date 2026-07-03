import {
  colorGroup,
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

function hashSeed(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }
  return hash
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

function deterministicRating(productId: string): number {
  const seed = hashSeed(productId)
  return 4 + (seed % 10) / 10
}

function deterministicReviewCount(productId: string): number {
  const seed = hashSeed(`${productId}-reviews`)
  return 8 + (seed % 120)
}

function deterministicStock(productId: string, size: string, colorHex: string): number {
  const seed = hashSeed(`${productId}:${size}:${colorHex}`)
  return 3 + (seed % 18)
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

export function generateVariants(product: StorefrontProduct): ProductVariantData[] {
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
        stock: deterministicStock(product.id, size, colorHex),
        image: product.image,
        isActive: true,
      })
    }
  }

  return variants
}

export function isStorefrontProductInStock(product: StorefrontProduct): boolean {
  if (typeof product.inStock === 'boolean') return product.inStock
  return generateVariants(product).some((variant) => variant.stock > 0)
}

export function getStockForVariant(
  productId: string,
  size: string,
  colorHex: string,
  stockOverlay?: Record<string, number>,
): number {
  const id = variantId(productId, size, colorHex)
  if (stockOverlay && id in stockOverlay) {
    return stockOverlay[id] ?? 0
  }

  const product = products.find((entry) => entry.id === productId)
  if (!product) return 0

  return deterministicStock(productId, size, colorHex)
}

function baseCardFields(product: StorefrontProduct): ProductCardData {
  const slug = productSlug(product)
  const seed = hashSeed(product.id)

  return {
    id: product.id,
    slug,
    name: product.name,
    price: product.price,
    images: [product.image, product.hoverImage],
    colorOptions: colorOptions(product),
    isNewArrival: product.status === 'New',
    isBestSeller: seed % 3 === 0,
    isOnSale: product.status === 'Limited',
    rating: deterministicRating(product.id),
    reviewCount: deterministicReviewCount(product.id),
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
    metaTitle: `${product.name} | SPLARO`,
    metaDescription: `Shop ${product.name} at SPLARO. ${product.material}, ${product.fit} fit. Price in BDT ${product.price.toLocaleString('en-BD')}.`,
  }
}

export function getAllProducts(): ProductCardData[] {
  return products.map(toProductCard)
}

export function getAllProductSlugs(): Array<{ slug: string }> {
  return products.map((product) => ({ slug: productSlug(product) }))
}

export const catalog: ProductDetailData[] = products.map(toProductDetail)

export function getProductById(id: string): ProductDetailData | null {
  const product = products.find((entry) => entry.id === id)
  return product ? toProductDetail(product) : null
}

export function getProductBySlug(slug: string): ProductDetailData | null {
  const product = products.find((entry) => productSlug(entry) === slug || entry.id === slug)
  return product ? toProductDetail(product) : null
}

export function searchProducts(q: string): ProductCardData[] {
  const query = q.trim().toLowerCase()
  if (!query) return getAllProducts()

  return products
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
