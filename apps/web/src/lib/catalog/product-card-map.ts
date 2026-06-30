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
    rating: 4.5,
    reviewCount: 12,
    category: product.category,
  }
}
