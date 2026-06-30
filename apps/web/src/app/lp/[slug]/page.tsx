import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ContentPage } from '@/components/content/ContentPage'
import { getLandingPage } from '@/lib/content/get-landing-page'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await getLandingPage(slug)
  if (!page) return { title: 'Page not found' }
  return {
    title: page.metaTitle ?? page.title,
    description: page.metaDescription ?? page.description,
  }
}

export default async function LandingPageRoute({ params }: Props) {
  const { slug } = await params
  const page = await getLandingPage(slug)
  if (!page) notFound()
  return <ContentPage title={page.title} description={page.description} sections={page.sections} />
}
