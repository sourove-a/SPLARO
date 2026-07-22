import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isFeatureEnabled } from '@splaro/config'
import { ContentPage } from '@/components/content/ContentPage'
import { getLegalPage } from '@/lib/content/get-legal-page'

export async function generateMetadata(): Promise<Metadata> {
  if (!isFeatureEnabled('loyalty')) {
    return { title: 'Not found', robots: { index: false, follow: false } }
  }
  const page = await getLegalPage('loyalty')
  return {
    title: page.metaTitle ?? page.title,
    description: page.metaDescription ?? page.description,
  }
}

export default async function LoyaltyPage() {
  if (!isFeatureEnabled('loyalty')) notFound()

  const page = await getLegalPage('loyalty')
  return (
    <ContentPage
      title={page.title}
      description={page.description}
      sections={page.sections}
      variant="boxed"
    />
  )
}
