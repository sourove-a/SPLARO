import { ContentPage } from '@/components/content/ContentPage'
import { getLegalPage } from '@/lib/content/get-legal-page'
import { buildFaqPageJsonLd } from '@/lib/seo/geo-json-ld'
import { createRouteMetadata } from '@/lib/seo/route-metadata'

export async function generateMetadata() {
  const page = await getLegalPage('faq')
  return createRouteMetadata({
    title: page.metaTitle ?? page.title,
    description: page.metaDescription ?? page.description,
    path: '/faq',
  })
}

export default async function FaqPage() {
  const page = await getLegalPage('faq')
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildFaqPageJsonLd(page.sections) }}
      />
      <ContentPage
        title={page.title}
        description={page.description}
        sections={page.sections}
        variant="faq"
        premiumBadge="FAQ · Help Center"
      />
    </>
  )
}
