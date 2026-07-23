import type { Metadata } from 'next'
import type { LegalPageSlug } from '@splaro/types'
import { getLegalPage } from '@/lib/content/get-legal-page'
import { createRouteMetadata } from '@/lib/seo/route-metadata'

/** CMS legal/policy pages — always emit canonical + OG/Twitter. */
export async function legalPageMetadata(
  slug: LegalPageSlug,
  path: `/${string}`,
): Promise<Metadata> {
  const page = await getLegalPage(slug)
  return createRouteMetadata({
    title: page.metaTitle ?? page.title,
    description: page.metaDescription ?? page.description,
    path,
  })
}
