import { redirect } from 'next/navigation'
import { isCollectionSlugAccessible, mergeCatalogChannels } from '@splaro/types'
import { CollectionShopClient } from '@/app/collections/[slug]/collection-shop-client'
import { getStorefrontCatalogForCollection } from '@/lib/catalog/server'
import { resolveCollectionContext } from '@/lib/storefront/collection-context'
import { getStorefrontSettings } from '@/lib/storefront/settings'
import { collectionHref } from '@/lib/storefront/collection-paths'
import { buildCollectionPageJsonLd } from '@/lib/seo/geo-json-ld'

export { titleFromCollectionSlug } from '@/lib/storefront/collection-context'

/** Meta description only — not rendered as visible PLP copy. */
export function buildCategoryIntro(title: string): string {
  return `Shop ${title} from SPLARO — premium fashion for everyday wear in Bangladesh, with cash on delivery and nationwide courier.`
}

export function buildCategoryMetaDescription(title: string): string {
  return `${buildCategoryIntro(title)} Browse the full catalog on Shop, or explore Men, Women, Kids, Footwear and Accessories.`
}

export async function CollectionPageContent({ slug }: { slug: string }) {
  const settings = await getStorefrontSettings()
  const channels = mergeCatalogChannels(settings.config.catalogChannels ?? [])

  if (!isCollectionSlugAccessible(slug, channels)) {
    redirect('/shop')
  }

  const context = resolveCollectionContext(slug, channels)
  const catalog = await getStorefrontCatalogForCollection(context)
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
