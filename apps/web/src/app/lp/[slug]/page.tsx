import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ContentCampaignLanding } from '@/components/content/ContentCampaignLanding'
import { getLandingPage } from '@/lib/content/get-landing-page'
import { tidyMetaDescription } from '@/lib/seo/meta-description'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await getLandingPage(slug)
  if (!page) return { title: 'Page not found' }
  return {
    title: page.metaTitle ?? page.title,
    description: tidyMetaDescription(page.metaDescription ?? page.description),
  }
}

export default async function LandingPageRoute({ params }: Props) {
  const { slug } = await params
  const page = await getLandingPage(slug)
  if (!page) notFound()
  return (
    <ContentCampaignLanding
      title={page.title}
      description={page.description}
      sections={page.sections}
    />
  )
}
