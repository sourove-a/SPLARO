import { ContentPage } from '@/components/content/ContentPage'
import { getLegalPage } from '@/lib/content/get-legal-page'
import { legalPageMetadata } from '@/lib/seo/legal-metadata'

export async function generateMetadata() {
  return legalPageMetadata('shipping', '/shipping')
}

export default async function ShippingPage() {
  const page = await getLegalPage('shipping')
  return (
    <ContentPage
      title={page.title}
      description={page.description}
      sections={page.sections}
      variant="premium"
      premiumBadge="Shipping Policy · 2026"
    />
  )
}
