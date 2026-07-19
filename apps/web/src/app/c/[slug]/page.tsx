import type { Metadata } from 'next'
import { CollectionPageContent, titleFromCollectionSlug } from '@/lib/storefront/collection-page'
import { collectionHref } from '@/lib/storefront/collection-paths'
import { createRouteMetadata } from '@/lib/seo/route-metadata'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const title = titleFromCollectionSlug(slug)
  return createRouteMetadata({
    title: `${title} — Shop`,
    description: `Shop SPLARO ${title} collection with filters, quick add, and bKash or Nagad checkout.`,
    path: collectionHref(slug) as `/${string}`,
  })
}

export default async function ShortCollectionRoute({ params }: Props) {
  const { slug } = await params
  return <CollectionPageContent slug={slug} />
}
