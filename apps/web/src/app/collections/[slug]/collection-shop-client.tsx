'use client'

import { ShopExperience } from '@/components/shop/ShopExperience'
import { categoryFromSlug } from '@/data/storefront'
import type { CachedCatalog } from '@/lib/catalog/server'

interface CollectionShopClientProps {
  slug: string
  initialCatalog?: CachedCatalog
}

export function CollectionShopClient({ slug, initialCatalog }: CollectionShopClientProps) {
  const category = categoryFromSlug(slug) ?? 'All'

  return (
    <ShopExperience
      initialCategory={category}
      showCollections={false}
      {...(initialCatalog ? { initialCatalog } : {})}
    />
  )
}
