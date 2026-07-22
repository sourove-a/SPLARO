'use client'

import { SplaroProductCard } from '@/components/product/ProductCard/SplaroProductCard'
import { ProductCardSkeleton } from '@/components/product/ProductCard/ProductCardSkeleton'
import {
  PremiumSwiperCarousel,
  RELATED_SWIPER_BREAKPOINTS,
} from '@/components/ui/PremiumSwiperCarousel'
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import type { ProductCardData } from '@/types/product'

/**
 * “You may also like” — flat slide rail (no coverflow tilt).
 * Shop cards: bag add only — no wishlist heart (not useful on related rail).
 */
export function ProductRelatedSection({ products }: { products: ProductCardData[] }) {
  if (!products.length) return null

  return (
    <section className="pp-related">
      <h2 className="pp-related__title">You may also like</h2>
      <PremiumSwiperCarousel
        className="pp-related__swiper"
        effect="slide"
        speed={420}
        spaceBetween={16}
        freeScroll
        breakpoints={RELATED_SWIPER_BREAKPOINTS}
        ariaLabel="Related products"
      >
        {products.map((item) => {
          const images = (item.images ?? []).map((url) => url?.trim()).filter(Boolean) as string[]
          const primary = images[0] ?? PRODUCT_IMAGE_PLACEHOLDER
          const colors =
            item.colorHexes ??
            item.colorOptions?.map((c) => c.hex).filter(Boolean) ??
            []

          return (
            <div key={item.id} className="pp-related__cell">
              <SplaroProductCard
                id={item.id}
                name={item.name}
                slug={item.slug}
                price={item.price}
                image={primary}
                variant="shop"
                fit="contain"
                {...(item.compareAtPrice != null ? { compareAtPrice: item.compareAtPrice } : {})}
                {...(images[1] ? { imageHover: images[1] } : {})}
                {...(images.length > 2 ? { galleryImages: images } : {})}
                {...(item.sizes?.length ? { sizes: item.sizes } : {})}
                {...(colors.length ? { colorHexes: colors } : {})}
                {...(item.category ? { category: item.category } : {})}
              />
            </div>
          )
        })}
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
