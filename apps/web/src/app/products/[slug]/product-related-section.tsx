'use client'

import { ProductCard } from '@/components/product/ProductCard/ProductCard'
import { ProductReveal } from '@/components/product/ProductMotion'
import type { ProductCardData } from '@/types/product'

export function ProductRelatedSection({ products }: { products: ProductCardData[] }) {
  if (!products.length) return null

  return (
    <ProductReveal>
      <section className="pp-related">
        <h2 className="pp-related__title">You may also like</h2>
        <div className="pp-related__grid">
          {products.map((item) => (
            <ProductCard key={item.id} product={item} />
          ))}
        </div>
      </section>
    </ProductReveal>
  )
}

export function ProductRelatedSkeleton() {
  return (
    <section className="pp-related" aria-hidden>
      <div className="mb-4 h-6 w-40 animate-pulse rounded bg-black/8" />
      <div className="pp-related__grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-black/5" />
        ))}
      </div>
    </section>
  )
}
