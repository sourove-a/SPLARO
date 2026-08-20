'use client'

import { useEffect, useState } from 'react'
import { SplaroProductCard } from '@/components/product/ProductCard/SplaroProductCard'
import {
  PremiumSwiperCarousel,
  RELATED_SWIPER_BREAKPOINTS,
} from '@/components/ui/PremiumSwiperCarousel'
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import { storefrontToCardData } from '@/lib/catalog/product-card-map'
import { getRecentlyViewed } from '@/lib/recentlyViewed'
import type { StorefrontProduct } from '@/data/storefront'
import type { ProductCardData } from '@/types/product'

/** Guest-only, localStorage-backed — reads ids tracked by trackRecentlyViewed(). */
export function RecentlyViewedSection({ excludeId }: { excludeId: string }) {
  const [products, setProducts] = useState<ProductCardData[] | null>(null)

  useEffect(() => {
    const ids = getRecentlyViewed(excludeId)
    if (!ids.length) {
      setProducts([])
      return
    }

    let cancelled = false
    fetch(`/api/products?ids=${encodeURIComponent(ids.join(','))}`)
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then((data: { products?: (StorefrontProduct & { slug?: string })[] }) => {
        if (cancelled) return
        const byId = new Map((data.products ?? []).map((p) => [p.id, p]))
        const ordered = ids
          .map((id) => byId.get(id))
          .filter((p): p is StorefrontProduct & { slug?: string } => Boolean(p))
          .map(storefrontToCardData)
        setProducts(ordered)
      })
      .catch(() => {
        if (!cancelled) setProducts([])
      })

    return () => {
      cancelled = true
    }
  }, [excludeId])

  if (!products?.length) return null

  return (
    <section className="pp-related pp-related--recently-viewed">
      <h2 className="pp-related__title">Recently Viewed</h2>
      <PremiumSwiperCarousel
        className="pp-related__swiper"
        effect="slide"
        speed={420}
        spaceBetween={16}
        freeScroll
        breakpoints={RELATED_SWIPER_BREAKPOINTS}
        ariaLabel="Recently viewed products"
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
                {...(item.colorOptions?.length ? { colorOptions: item.colorOptions } : {})}
                {...(item.category ? { category: item.category } : {})}
              />
            </div>
          )
        })}
      </PremiumSwiperCarousel>
    </section>
  )
}
