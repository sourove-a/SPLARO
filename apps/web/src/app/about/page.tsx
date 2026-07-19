import { ContentPage } from '@/components/content/ContentPage'
import { getLegalPage } from '@/lib/content/get-legal-page'
import { createRouteMetadata } from '@/lib/seo/route-metadata'

export async function generateMetadata() {
  const page = await getLegalPage('about')
  return createRouteMetadata({
    title: page.metaTitle ?? page.title,
    description: page.metaDescription ?? page.description,
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
