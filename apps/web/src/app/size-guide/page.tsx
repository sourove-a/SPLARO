import { ContentPage } from '@/components/content/ContentPage'
import { getLegalPage } from '@/lib/content/get-legal-page'
import { legalPageMetadata } from '@/lib/seo/legal-metadata'

export async function generateMetadata() {
  return legalPageMetadata('size-guide', '/size-guide')
}

export default async function SizeGuidePage() {
  const page = await getLegalPage('size-guide')
  return (
    <ContentPage
      title={page.title || 'Size Guide'}
      description="Women, men & kids — centimetres, true to size."
      sections={page.sections}
      variant="size-guide"
      premiumBadge="Fit · Atelier"
    />
  )
}
