'use client'

import { ShopExperience } from '@/components/shop/ShopExperience'
import type { CachedCatalog } from '@/lib/catalog/server'
import type { CollectionShopContext } from '@/lib/storefront/collection-context'

interface CollectionShopClientProps {
  slug: string
  context: CollectionShopContext
  initialCatalog?: CachedCatalog
}

export function CollectionShopClient({
  slug,
  context,
  initialCatalog,
}: CollectionShopClientProps) {
  return (
    <ShopExperience
      initialCategory={context.initialCategory}
      showCollections={false}
      pageEyebrow="Collection"
      pageTitle={context.title}
      pageDescription={`Browse ${context.title} with size, colour, and price filters.`}
      collectionSlug={slug}
      {...(context.categorySlug ? { categorySlug: context.categorySlug } : {})}
      listingMode="scoped"
      {...(initialCatalog ? { initialCatalog } : {})}
    />
  )
}
