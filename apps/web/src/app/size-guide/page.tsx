import type { Metadata } from 'next'
import { ContentPage } from '@/components/content/ContentPage'
import { SizeGuideTables } from '@/components/content/SizeGuideTables'
import { getLegalPage } from '@/lib/content/get-legal-page'

export async function generateMetadata(): Promise<Metadata> {
  const page = await getLegalPage('size-guide')
  return {
    title: page.metaTitle ?? page.title,
    description: page.metaDescription ?? page.description,
  }
}

export default async function SizeGuidePage() {
  const page = await getLegalPage('size-guide')
  return (
    <ContentPage title={page.title} description={page.description} sections={page.sections}>
      <SizeGuideTables />
    </ContentPage>
  )
}
