import { ContentPage } from '@/components/content/ContentPage'
import { getLegalPage } from '@/lib/content/get-legal-page'
import { legalPageMetadata } from '@/lib/seo/legal-metadata'

export async function generateMetadata() {
  return legalPageMetadata('payment-policy', '/payment-policy')
}

export default async function PaymentPolicyPage() {
  const page = await getLegalPage('payment-policy')
  return (
    <ContentPage
      title={page.title}
      description={page.description}
      sections={page.sections}
      variant="premium"
      premiumBadge="Payment Policy · 2026"
    />
  )
}
