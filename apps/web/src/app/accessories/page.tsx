import { Suspense } from 'react'
import { mergeCatalogChannels } from '@splaro/types'
import { ShopExperience } from '@/components/shop/ShopExperience'
import { getStorefrontCatalogForCollection } from '@/lib/catalog/server'
import {
  buildCategoryIntro,
  buildCategoryMetaDescription,
} from '@/lib/storefront/collection-page'
import { resolveCollectionContext } from '@/lib/storefront/collection-context'
import { ACCESSORY_COLLECTION_SLUGS } from '@/lib/storefront/accessories-slugs'
import { createRouteMetadata } from '@/lib/seo/route-metadata'
import { getStorefrontSettings } from '@/lib/storefront/settings'
import type { ShopCatalogPreset } from '@/components/shop/ShopCatalog'

export const revalidate = 60

interface AccessoriesPageProps {
  searchParams: Promise<{ cat?: string; filter?: string }>
}

function resolveAccessoriesSlug(cat?: string): string {
  const trimmed = cat?.trim()
  if (!trimmed || trimmed === 'all') return 'accessories'
  if (ACCESSORY_COLLECTION_SLUGS.has(trimmed) || trimmed.startsWith('accessories')) {
    return trimmed
  }
  return 'accessories'
}

export async function generateMetadata({
  searchParams,
}: AccessoriesPageProps): Promise<ReturnType<typeof createRouteMetadata>> {
  const { cat } = await searchParams
  const slug = resolveAccessoriesSlug(cat)
  const settings = await getStorefrontSettings()
  const channels = mergeCatalogChannels(settings.config.catalogChannels ?? [])
  const context = resolveCollectionContext(slug, channels)
  const title = slug === 'accessories' ? 'Accessories' : context.title
  return createRouteMetadata({
    title,
    description: buildCategoryMetaDescription(title),
    path: '/accessories',
  })
}

export default async function AccessoriesPage({ searchParams }: AccessoriesPageProps) {
  const { cat, filter } = await searchParams
  const slug = resolveAccessoriesSlug(cat)
  const settings = await getStorefrontSettings()
  const channels = mergeCatalogChannels(settings.config.catalogChannels ?? [])
  const context = resolveCollectionContext(slug, channels)
  const catalog = await getStorefrontCatalogForCollection(context)

  const preset: ShopCatalogPreset | undefined =
    filter === 'new' || filter === 'new-arrivals'
      ? 'new-arrivals'
      : filter === 'bestsellers' || filter === 'best-sellers'
        ? 'best-sellers'
        : undefined

  const pageTitle = slug === 'accessories' ? 'Accessories' : context.title

  return (
    <Suspense fallback={<div className="shop-page-shell min-h-[50vh]" />}>
      <ShopExperience
        key={`accessories:${slug}:${preset ?? 'all'}`}
        initialCategory={context.initialCategory}
        showCollections={false}
        pageTitle={pageTitle}
        collectionSlug={context.collectionSlug}
        parentCategorySlug={
          slug === 'accessories' ? 'accessories' : context.parentCategorySlug
        }
        {...(context.categorySlug && slug !== 'accessories'
          ? { categorySlug: context.categorySlug }
          : slug !== 'accessories'
            ? { categorySlug: slug }
            : {})}
        listingMode="scoped"
        initialCatalog={catalog}
        categoryIntro={buildCategoryIntro(pageTitle)}
        {...(preset ? { catalogPreset: preset } : {})}
      />
    </Suspense>
  )
}
