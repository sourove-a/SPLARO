import {
  isStorefrontBestSeller,
  isStorefrontNewArrival,
  type StorefrontProduct,
} from '@/data/storefront'
import { productSlug } from '@/lib/catalog/index'
import type { ProductCardData } from '@/types/product'

export function storefrontToCardData(
  product: StorefrontProduct & { slug?: string },
): ProductCardData {
  const slug = product.slug ?? productSlug(product)
  const fromMedia =
    product.media?.filter((entry) => entry.type === 'image').map((entry) => entry.url) ?? []
  const fromColors = product.colorOptions?.map((color) => color.image) ?? []
  const images = [product.image, product.hoverImage, ...fromMedia, ...fromColors]
    .map((url) => url?.trim())
    .filter(Boolean)
    .filter((url, index, arr) => arr.indexOf(url) === index)
    .slice(0, 4) as string[]

  const colorOptions = product.colorOptions?.map((color) => ({
    hex: color.hex,
    name: color.name,
  }))

  const apiRating = Number(product.rating ?? 0)
  const apiReviewCount = Number(product.reviewCount ?? 0)
  const hasReviews = apiReviewCount > 0 && apiRating > 0
  const sizes = product.sizes?.length ? product.sizes : undefined
  const colorHexes = product.colors?.length ? product.colors : undefined
  const variantRefs = product.variantRefs?.length ? product.variantRefs : undefined

  return {
    id: product.id,
    slug,
    name: product.name,
    price: product.price,
    ...(product.compareAtPrice ? { compareAtPrice: product.compareAtPrice } : {}),
    images,
    ...(colorOptions?.length ? { colorOptions } : {}),
    ...(sizes ? { sizes } : {}),
    ...(colorHexes ? { colorHexes } : {}),
    ...(variantRefs ? { variantRefs } : {}),
    isNewArrival: isStorefrontNewArrival(product),
    isBestSeller: isStorefrontBestSeller(product),
    isOnSale: Boolean(product.compareAtPrice && product.compareAtPrice > product.price),
    rating: hasReviews ? apiRating : 0,
    reviewCount: hasReviews ? apiReviewCount : 0,
    category: product.category,
    ...(product.categorySlug ? { categorySlug: product.categorySlug } : {}),
    ...(product.tags?.length ? { tags: product.tags } : {}),
    ...(product.isUnisex ? { isUnisex: true } : {}),
    ...(typeof product.stockUnits === 'number'
      ? { stockUnits: product.stockUnits }
      : product.variantRefs?.length
        ? {
            stockUnits: product.variantRefs
              .filter((ref) => ref.isActive !== false)
              .reduce((sum, ref) => sum + Math.max(0, Number(ref.stock) || 0), 0),
          }
        : {}),
  }
}
