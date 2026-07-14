import type { ProductDetailItem } from '@/components/product/ProductDetailPanel/ProductDetailPanel'
import type { StorefrontProduct } from '@/data/storefront'

export function storefrontToDetailItem(
  product: StorefrontProduct & { slug?: string },
): ProductDetailItem {
  return {
    id: product.id,
    name: product.name,
    code: product.code,
    category: product.category,
    price: product.price,
    ...(product.compareAtPrice ? { compareAtPrice: product.compareAtPrice } : {}),
    colors: product.colors,
    ...(product.colorOptions ? { colorOptions: product.colorOptions } : {}),
    sizes: product.sizes,
    status: product.status,
    image: product.image,
    hoverImage: product.hoverImage,
    ...(product.media ? { media: product.media } : {}),
    fit: product.fit,
    material: product.material,
  }
}
