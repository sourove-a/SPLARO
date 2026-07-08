'use client'

import { ShopCatalog, type ShopCatalogPreset } from '@/components/shop/ShopCatalog'
import { ShopCollectionsSection } from '@/components/shop/ShopCollectionsSection'
import type { Category } from '@/data/storefront'
import type { CollectionCard } from '@/data/storefront'
import type { CachedCatalog } from '@/lib/catalog/server'
import type { CatalogSortOption } from '@/lib/shop/mobile-filter'

interface ShopExperienceProps {
  initialCategory?: Category
  showCollections?: boolean
  initialCatalog?: CachedCatalog
  collectionCards?: CollectionCard[]
  catalogPreset?: ShopCatalogPreset
  initialSort?: CatalogSortOption
  pageEyebrow?: string
  pageTitle?: string
  pageDescription?: string
  collectionSlug?: string
  categorySlug?: string
  listingMode?: 'full' | 'scoped'
}

export function ShopExperience({
  initialCategory = 'All',
  showCollections = true,
  initialCatalog,
  collectionCards = [],
  catalogPreset,
  initialSort,
  pageEyebrow,
  pageTitle,
  pageDescription,
  collectionSlug,
  categorySlug,
  listingMode = collectionSlug || categorySlug ? 'scoped' : 'full',
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
      {showCollections ? <ShopCollectionsSection cards={collectionCards} /> : null}

      <ShopCatalog
        initialCategory={initialCategory}
        {...(initialCatalog ? { initialCatalog } : {})}
        {...(catalogPreset ? { catalogPreset } : {})}
        {...(initialSort ? { initialSort } : {})}
        {...(collectionSlug ? { collectionSlug } : {})}
        {...(categorySlug ? { categorySlug } : {})}
        listingMode={listingMode}
      />
    </div>
  )
}
