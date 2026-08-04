import type { Metadata } from 'next'
import { mergeCatalogChannels } from '@splaro/types'
import {
  buildCategoryMetaDescription,
  CollectionPageContent,
  titleFromCollectionSlug,
} from '@/lib/storefront/collection-page'
import { getStorefrontCatalogForCollection } from '@/lib/catalog/server'
import { resolveCollectionContext } from '@/lib/storefront/collection-context'
import { createRouteMetadata } from '@/lib/seo/route-metadata'
import { getStorefrontSettings } from '@/lib/storefront/settings'

interface CollectionPageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params
  const settings = await getStorefrontSettings()
  const channels = mergeCatalogChannels(settings.config.catalogChannels ?? [])
  const context = resolveCollectionContext(slug, channels)
  const catalog = await getStorefrontCatalogForCollection(context)
  const productCount = catalog.total ?? catalog.products.length
  const title = context.title || titleFromCollectionSlug(slug)
  const meta = createRouteMetadata({
    title: `${title} — Shop`,
    description: buildCategoryMetaDescription(title),
    path: `/collections/${slug}`,
  })
  if (productCount <= 1) {
    return {
      ...meta,
      robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
    }
  }
  return meta
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { slug } = await params
  return <CollectionPageContent slug={slug} />
}
