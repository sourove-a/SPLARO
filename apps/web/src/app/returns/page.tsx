import { ContentPage } from '@/components/content/ContentPage'
import { getLegalPage } from '@/lib/content/get-legal-page'
import { legalPageMetadata } from '@/lib/seo/legal-metadata'

export async function generateMetadata() {
  return legalPageMetadata('returns', '/returns')
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
