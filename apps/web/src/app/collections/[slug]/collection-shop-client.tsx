'use client'

import { ShopExperience } from '@/components/shop/ShopExperience'
import type { CachedCatalog } from '@/lib/catalog/server'
import type { CollectionShopContext } from '@/lib/storefront/collection-context'

interface CollectionShopClientProps {
  slug: string
  context: CollectionShopContext
  initialCatalog?: CachedCatalog
  categoryIntro?: string
  thinCatalog?: boolean
}

export function CollectionShopClient({
  slug,
  context,
  initialCatalog,
  categoryIntro,
  thinCatalog,
}: CollectionShopClientProps) {
  return (
    <ShopExperience
      key={`collection:${slug}`}
      initialCategory={context.initialCategory}
      showCollections={false}
      pageTitle={context.title}
      collectionSlug={slug}
      parentCategorySlug={context.parentCategorySlug}
      {...(context.categorySlug ? { categorySlug: context.categorySlug } : {})}
      listingMode="scoped"
      {...(initialCatalog ? { initialCatalog } : {})}
      {...(categoryIntro ? { categoryIntro } : {})}
      {...(thinCatalog ? { thinCatalog: true } : {})}
    />
  )
}
