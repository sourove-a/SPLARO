'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { ShopCatalog, type ShopCatalogPreset } from '@/components/shop/ShopCatalog'
import { ShopCollectionsSection } from '@/components/shop/ShopCollectionsSection'
import { ShopBreadcrumbs } from '@/components/shop/ShopBreadcrumbs'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { resolveCollectionBreadcrumbs } from '@/lib/storefront/collection-subnav'
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
  /** Breadcrumb label fallback + screen-reader page title (no hero block). */
  pageTitle?: string
  collectionSlug?: string
  parentCategorySlug?: string
  categorySlug?: string
  listingMode?: 'full' | 'scoped' | 'paged'
  categoryIntro?: string
  thinCatalog?: boolean
}

export function ShopExperience({
  initialCategory = 'All',
  showCollections = true,
  initialCatalog,
  collectionCards = [],
  catalogPreset,
  initialSort,
  pageTitle,
  collectionSlug,
  parentCategorySlug,
  categorySlug,
  listingMode = collectionSlug || categorySlug || parentCategorySlug ? 'scoped' : 'full',
  categoryIntro,
  thinCatalog,
}: ShopExperienceProps) {
  const settings = useStorefrontSettings()
  const headerNav = settings.config.headerNav

  const breadcrumbs = useMemo(
    () => resolveCollectionBreadcrumbs(collectionSlug, pageTitle, headerNav),
    [collectionSlug, pageTitle, headerNav],
  )

  return (
    <div className="shop-page-shell shop-page-shell--soft-enter">
      <div className="shop-page-intro">
        <div className="shop-page-intro__top">
          <ShopBreadcrumbs items={breadcrumbs} />
          {pageTitle ? <h1 className="sr-only">{pageTitle}</h1> : null}
        </div>
        {categoryIntro ? (
          <p className="shop-page-intro__copy">
            {categoryIntro}{' '}
            <Link href="/shop" className="shop-page-intro__link">
              Shop all
            </Link>
            {thinCatalog ? ' — more styles are added regularly.' : '.'}
          </p>
        ) : null}
      </div>

      {showCollections ? <ShopCollectionsSection cards={collectionCards} /> : null}

      <ShopCatalog
        initialCategory={initialCategory}
        {...(initialCatalog ? { initialCatalog } : {})}
        {...(catalogPreset ? { catalogPreset } : {})}
        {...(initialSort ? { initialSort } : {})}
        {...(collectionSlug ? { collectionSlug } : {})}
        {...(parentCategorySlug ? { parentCategorySlug } : {})}
        {...(categorySlug ? { categorySlug } : {})}
        listingMode={listingMode}
      />
    </div>
  )
}
