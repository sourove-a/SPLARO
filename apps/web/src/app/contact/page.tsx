import { ContentPage } from '@/components/content/ContentPage'
import { ContactExtras } from '@/components/content/ContactExtras'
import { getLegalPage } from '@/lib/content/get-legal-page'
import { createRouteMetadata } from '@/lib/seo/route-metadata'

export async function generateMetadata() {
  const page = await getLegalPage('contact')
  return createRouteMetadata({
    title: page.metaTitle ?? page.title,
    description: page.metaDescription ?? page.description,
    path: '/contact',
  })
}

export default async function ContactPage() {
  const page = await getLegalPage('contact')
  return (
    <ContentPage
      title={page.title}
      description={page.description}
      sections={page.sections}
      variant="contact"
      premiumBadge="Care · Studio"
    >
      <ContactExtras />
    </ContentPage>
  )
}
