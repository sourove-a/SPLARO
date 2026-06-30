import type { Metadata } from 'next'
import { CollectionPageContent, titleFromCollectionSlug } from '@/lib/storefront/collection-page'
import { collectionHref } from '@/lib/storefront/collection-paths'

interface CollectionPageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params
  const title = titleFromCollectionSlug(slug)
  return {
    title: `${title} — Shop SPLARO`,
    description: `Shop SPLARO ${title} collection with filters, quick add, and bKash or Nagad checkout.`,
    alternates: { canonical: collectionHref(slug) },
  }
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { slug } = await params
  return <CollectionPageContent slug={slug} />
}
