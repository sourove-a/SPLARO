import { colorGroup, type StorefrontProduct } from '@/data/storefront'
import { productSlug } from '@/lib/catalog/index'
import { storefrontToCardData } from '@/lib/catalog/product-card-map'
import { sanitizeStorefrontProductCode } from '@/lib/catalog/storefront-sanitize'

export interface QuickViewProduct {
  id: string
  slug: string
  name: string
  price: number
  compareAtPrice?: number
  productCode?: string
  href: string
  images: string[]
  sizes: string[]
  colors: string[]
  colorOptions: { hex: string; name: string; image?: string }[]
  inStock: boolean
  category?: string
  categorySlug?: string
  variantRefs?: StorefrontProduct['variantRefs']
}

export function buildQuickViewProduct(
  product: StorefrontProduct & { slug?: string },
): QuickViewProduct {
  const card = storefrontToCardData(product)
  const slug = product.slug ?? productSlug(product)
  const directCode = product.code?.trim()
  const productCode =
    directCode ||
    sanitizeStorefrontProductCode(
      (product as StorefrontProduct & { sku?: string }).sku,
      slug,
    ) ||
    undefined

  const colorOptions =
    product.colorOptions?.map((color) => ({
      hex: color.hex,
      name: color.name,
      image: color.image,
    })) ??
    product.colors.map((hex) => ({
      hex,
      name: colorGroup(hex),
    }))

  return {
    id: product.id,
    slug,
    name: product.name,
    price: product.price,
    ...(product.compareAtPrice ? { compareAtPrice: product.compareAtPrice } : {}),
    ...(productCode ? { productCode } : {}),
    href: `/products/${slug}`,
    images: card.images,
    sizes: product.sizes ?? [],
    colors: product.colors ?? [],
    colorOptions,
    inStock: product.inStock ?? true,
    ...(product.category ? { category: product.category } : {}),
    ...(product.categorySlug ? { categorySlug: product.categorySlug } : {}),
    ...(product.variantRefs?.length ? { variantRefs: product.variantRefs } : {}),
  }
}

export function quickViewImagesForColor(product: QuickViewProduct, colorHex?: string): string[] {
  if (!colorHex) return product.images
  const match = product.colorOptions.find(
    (color) => color.hex.toLowerCase() === colorHex.toLowerCase(),
  )
  if (match?.image) {
    const merged = [match.image, ...product.images.filter((url) => url !== match.image)]
    return merged.slice(0, 4)
  }
  return product.images
}

export function quickViewSizeInStock(
  product: QuickViewProduct,
  size: string,
  colorHex?: string,
): boolean {
  if (!product.inStock) return false
  const refs = (product.variantRefs ?? []).filter((ref) => ref.isActive)
  if (!refs.length) return true
  const hex = colorHex?.toLowerCase()
  return refs.some(
    (ref) =>
      ref.stock > 0 &&
      (!size || ref.size === size) &&
      (!hex || !ref.colorHex || ref.colorHex.toLowerCase() === hex),
  )
}
