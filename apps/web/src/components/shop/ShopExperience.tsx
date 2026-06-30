'use client'

import { ShopCatalog, type ShopCatalogPreset } from '@/components/shop/ShopCatalog'
import { ShopCollectionsSection } from '@/components/shop/ShopCollectionsSection'
import { sortOptions, type Category } from '@/data/storefront'
import type { CachedCatalog } from '@/lib/catalog/server'

interface ShopExperienceProps {
  initialCategory?: Category
  showCollections?: boolean
  initialCatalog?: CachedCatalog
  catalogPreset?: ShopCatalogPreset
  initialSort?: (typeof sortOptions)[number]
  pageEyebrow?: string
  pageTitle?: string
  pageDescription?: string
}

export function ShopExperience({
  initialCategory = 'All',
  showCollections = true,
  initialCatalog,
  catalogPreset,
  initialSort,
  pageEyebrow,
  pageTitle,
  pageDescription,
}: ShopExperienceProps) {
  return (
    <div className="shop-page-shell">
      {pageTitle ? (
        <section className="px-3 pb-2 pt-6 sm:px-5 lg:px-8">
          {pageEyebrow ? <p className="label-luxury mb-2 text-gold">{pageEyebrow}</p> : null}
          <h1 className="heading-xl text-luxury-black">{pageTitle}</h1>
          {pageDescription ? (
            <p className="mt-2 max-w-2xl text-sm text-luxury-gray">{pageDescription}</p>
          ) : null}
        </section>
      ) : null}
      {showCollections ? <ShopCollectionsSection /> : null}

      <ShopCatalog
        initialCategory={initialCategory}
        {...(initialCatalog ? { initialCatalog } : {})}
        {...(catalogPreset ? { catalogPreset } : {})}
        {...(initialSort ? { initialSort } : {})}
      />
    </div>
  )
}
