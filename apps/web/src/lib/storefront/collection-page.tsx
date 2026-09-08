import { notFound, redirect } from 'next/navigation'
import { CATEGORY_SUBCATEGORIES } from '@splaro/config'
import {
  isCollectionSlugAccessible,
  isJhingephoolCollectionSlug,
  mergeCatalogChannels,
  type CatalogChannel,
} from '@splaro/types'
import { CollectionShopClient } from '@/app/collections/[slug]/collection-shop-client'
import { getStorefrontCatalogForCollection } from '@/lib/catalog/server'
import { resolveCollectionContext } from '@/lib/storefront/collection-context'
import { getStorefrontSettings } from '@/lib/storefront/settings'
import { collectionHref } from '@/lib/storefront/collection-paths'
import { buildCollectionPageJsonLd } from '@/lib/seo/geo-json-ld'
import { fetchLiveCategories, fetchLiveCollections } from '@/lib/catalog/live'

export { titleFromCollectionSlug } from '@/lib/storefront/collection-context'

/** Meta description only — not rendered as visible PLP copy. */
export function buildCategoryIntro(title: string): string {
  return `Shop ${title} from SPLARO — premium fashion for everyday wear in Bangladesh, with cash on delivery and nationwide courier.`
}

export function buildCategoryMetaDescription(title: string): string {
  return `${buildCategoryIntro(title)} Browse the full catalog on Shop, or explore Men, Women, Kids, Footwear and Accessories.`
}

function isKnownStaticSubcategory(slug: string): boolean {
  for (const list of Object.values(CATEGORY_SUBCATEGORIES)) {
    if (list.some((item) => item.slug === slug)) return true
  }
  return false
}

export async function isValidCollectionOrCategory(
  slug: string,
  channels: CatalogChannel[],
  productCount: number,
): Promise<boolean> {
  if (productCount > 0) return true
  if (channels.some((c) => c.slug === slug && c.published !== false)) return true
  if (channels.some((c) => slug.startsWith(`${c.slug}-`) && c.published !== false)) return true
  if (isKnownStaticSubcategory(slug)) return true
  if (isJhingephoolCollectionSlug(slug)) return true

  const [liveCats, liveCols] = await Promise.all([
    fetchLiveCategories().catch(() => []),
    fetchLiveCollections().catch(() => []),
  ])
  if (liveCats.some((c) => c.slug === slug)) return true
  if (liveCols.some((c) => c.slug === slug)) return true

  return false
}

export async function CollectionPageContent({ slug }: { slug: string }) {
  const settings = await getStorefrontSettings()
  const channels = mergeCatalogChannels(settings.config.catalogChannels ?? [])

  if (!isCollectionSlugAccessible(slug, channels)) {
    redirect('/shop')
  }

  const context = resolveCollectionContext(slug, channels)
  const catalog = await getStorefrontCatalogForCollection(context)
  const productCount = catalog.total ?? catalog.products.length

  const valid = await isValidCollectionOrCategory(slug, channels, productCount)
  if (!valid) {
    notFound()
  }

  const pageLd = buildCollectionPageJsonLd({
    name: context.title,
    path: collectionHref(slug),
    items: catalog.products
      .filter((product) => Boolean(product.slug))
      .slice(0, 24)
      .map((product) => ({
        name: product.name,
        path: `/products/${product.slug}`,
      })),
  })

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageLd }} />
      <CollectionShopClient
        slug={slug}
        context={context}
        initialCatalog={catalog}
      />
    </>
  )
}
