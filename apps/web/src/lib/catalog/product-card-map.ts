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
  const images = [product.image, product.hoverImage].filter(
    (url, index, arr) => Boolean(url) && arr.indexOf(url) === index,
  )

  const colorOptions = product.colorOptions?.map((color) => ({
    hex: color.hex,
    name: color.name,
  }))

  const apiRating = Number(product.rating ?? 0)
  const apiReviewCount = Number(product.reviewCount ?? 0)
  const hasReviews = apiReviewCount > 0 && apiRating > 0

  return {
    id: product.id,
    slug,
    name: product.name,
    price: product.price,
    ...(product.compareAtPrice ? { compareAtPrice: product.compareAtPrice } : {}),
    images,
    ...(colorOptions?.length ? { colorOptions } : {}),
    isNewArrival: isStorefrontNewArrival(product),
    isBestSeller: isStorefrontBestSeller(product),
    isOnSale: Boolean(product.compareAtPrice && product.compareAtPrice > product.price),
    rating: hasReviews ? apiRating : 0,
    reviewCount: hasReviews ? apiReviewCount : 0,
    category: product.category,
  }
}
