import { ContentPage } from '@/components/content/ContentPage'
import { getLegalPage } from '@/lib/content/get-legal-page'
import { legalPageMetadata } from '@/lib/seo/legal-metadata'

export async function generateMetadata() {
  return legalPageMetadata('gift-card-policy', '/gift-card-policy')
}

export default async function GiftCardPolicyPage() {
  const page = await getLegalPage('gift-card-policy')
  return (
    <ContentPage
      title={page.title}
      description={page.description}
      sections={page.sections}
      variant="premium"
      premiumBadge="Gift Card Policy · 2026"
    />
  )
}
