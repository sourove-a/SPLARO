import { getRelatedProducts } from '@/lib/catalog/server'
import type { ProductDetailData } from '@/types/product'
import { ProductRelatedSection } from './product-related-section'

export async function RelatedProducts({ product }: { product: ProductDetailData }) {
  const related = await getRelatedProducts(product)
  return <ProductRelatedSection products={related} />
}
