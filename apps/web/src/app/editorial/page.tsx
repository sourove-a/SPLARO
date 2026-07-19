import { ContentPage } from '@/components/content/ContentPage'
import { getLegalPage } from '@/lib/content/get-legal-page'
import { createRouteMetadata } from '@/lib/seo/route-metadata'

export async function generateMetadata() {
  const page = await getLegalPage('editorial')
  return createRouteMetadata({
    title: page.metaTitle ?? page.title,
    description: page.metaDescription ?? page.description,
    path: '/editorial',
  })
}

export default async function EditorialPage() {
  const page = await getLegalPage('editorial')
  return (
    <ContentPage
      title={page.title}
      description={page.description}
      sections={page.sections}
      variant="boxed"
    />
  )
}
