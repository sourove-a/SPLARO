import type { Metadata } from 'next'
import { ContentPage } from '@/components/content/ContentPage'
import { ContactExtras } from '@/components/content/ContactExtras'
import { getLegalPage } from '@/lib/content/get-legal-page'

export async function generateMetadata(): Promise<Metadata> {
  const page = await getLegalPage('contact')
  return {
    title: page.metaTitle ?? page.title,
    description: page.metaDescription ?? page.description,
  }
}

export default async function ContactPage() {
  const page = await getLegalPage('contact')
  return (
    <ContentPage title={page.title} description={page.description} sections={page.sections}>
      <ContactExtras />
    </ContentPage>
  )
}
