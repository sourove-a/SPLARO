import { ContentPage } from '@/components/content/ContentPage'
import { getLegalPage } from '@/lib/content/get-legal-page'
import { legalPageMetadata } from '@/lib/seo/legal-metadata'

export async function generateMetadata() {
  return legalPageMetadata('privacy', '/privacy')
}

export default async function PrivacyPage() {
  const page = await getLegalPage('privacy')
  return (
    <ContentPage
      title={page.title}
      description={page.description}
      sections={page.sections}
      variant="boxed"
    />
  )
}
