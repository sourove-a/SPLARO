'use client'

import { ProductCard } from '@/components/product/ProductCard/ProductCard'
import { ProductCardSkeleton } from '@/components/product/ProductCard/ProductCardSkeleton'
import {
  PremiumSwiperCarousel,
  RELATED_SWIPER_BREAKPOINTS,
} from '@/components/ui/PremiumSwiperCarousel'
import type { ProductCardData } from '@/types/product'

/**
 * “You may also like” — flat slide rail (no coverflow tilt).
 */
export function ProductRelatedSection({ products }: { products: ProductCardData[] }) {
  if (!products.length) return null

  return (
    <section className="pp-related">
      <h2 className="pp-related__title">You may also like</h2>
      <PremiumSwiperCarousel
        className="pp-related__swiper"
        effect="slide"
        speed={300}
        spaceBetween={24}
        breakpoints={RELATED_SWIPER_BREAKPOINTS}
        ariaLabel="Related products"
      >
        {products.map((item) => (
          <div key={item.id} className="pp-related__cell">
            <ProductCard product={item} variant="shop" />
          </div>
        ))}
      </PremiumSwiperCarousel>
    </section>
  )
}

export function ProductRelatedSkeleton() {
  return (
    <section className="pp-related" aria-busy="true" aria-label="Loading related products">
      <div className="mb-4 h-6 w-40 overflow-hidden rounded-full bg-[#ececec]" aria-hidden />
      <div className="pp-related__grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="pp-related__cell min-w-0">
            <ProductCardSkeleton />
          </div>
        ))}
      </div>
    </section>
  )
}
