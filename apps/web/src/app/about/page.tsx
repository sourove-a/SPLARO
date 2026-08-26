import { ContentPage } from '@/components/content/ContentPage'
import { getLegalPage } from '@/lib/content/get-legal-page'
import { createRouteMetadata } from '@/lib/seo/route-metadata'
import { tidyMetaDescription } from '@/lib/seo/meta-description'

export async function generateMetadata() {
  const page = await getLegalPage('about')
  return createRouteMetadata({
    title: page.metaTitle ?? page.title,
    description: tidyMetaDescription(page.metaDescription ?? page.description),
    path: '/about',
  })
}

export default async function AboutPage() {
  const page = await getLegalPage('about')
  return (
    <ContentPage
      title={page.title}
      description={page.description}
      sections={page.sections}
      variant="about"
      premiumBadge="About · Crafted in Dhaka"
    />
  )
}
