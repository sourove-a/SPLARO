import { ContentPage } from '@/components/content/ContentPage'
import { getLegalPage } from '@/lib/content/get-legal-page'
import { legalPageMetadata } from '@/lib/seo/legal-metadata'

export async function generateMetadata() {
  return legalPageMetadata('terms', '/terms')
}

export default async function TermsPage() {
  const page = await getLegalPage('terms')
  return (
    <ContentPage
      title={page.title}
      description={page.description}
      sections={page.sections}
      variant="premium"
      premiumBadge="Terms & Conditions · 2026"
    />
  )
}
