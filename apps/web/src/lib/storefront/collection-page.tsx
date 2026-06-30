import { notFound } from 'next/navigation'
import { isCollectionSlugAccessible } from '@splaro/types'
import { CollectionShopClient } from '@/app/collections/[slug]/collection-shop-client'
import { getStorefrontCatalog } from '@/lib/catalog/server'
import { getStorefrontSettings } from '@/lib/storefront/settings'

export function titleFromCollectionSlug(slug: string) {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export async function CollectionPageContent({ slug }: { slug: string }) {
  const settings = await getStorefrontSettings()
  const channels = settings.config.catalogChannels ?? []

  if (!isCollectionSlugAccessible(slug, channels)) {
    notFound()
  }

  const catalog = await getStorefrontCatalog()
  return <CollectionShopClient slug={slug} initialCatalog={catalog} />
}
