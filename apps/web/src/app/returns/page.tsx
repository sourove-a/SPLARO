import type { Metadata } from 'next'
import { ContentPage } from '@/components/content/ContentPage'
import { getLegalPage } from '@/lib/content/get-legal-page'

export async function generateMetadata(): Promise<Metadata> {
  const page = await getLegalPage('returns')
  return {
    title: page.metaTitle ?? page.title,
    description: page.metaDescription ?? page.description,
  }
}

export default async function ReturnsPage() {
  const page = await getLegalPage('returns')
  return (
    <ContentPage
      title={page.title}
      description={page.description}
      sections={page.sections}
      variant="premium"
      premiumBadge="Returns & Exchange · 2026"
    />
  )
}
