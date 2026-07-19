import type { Metadata } from 'next'
import { CollectionPageContent, titleFromCollectionSlug } from '@/lib/storefront/collection-page'
import { createRouteMetadata } from '@/lib/seo/route-metadata'

interface CollectionPageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params
  const title = titleFromCollectionSlug(slug)
  return createRouteMetadata({
    title: `${title} — Shop`,
    description: `Shop SPLARO ${title} collection with filters, quick add, and bKash or Nagad checkout.`,
    path: `/collections/${slug}`,
  })
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { slug } = await params
  return <CollectionPageContent slug={slug} />
}
