import { getApiBaseUrl } from '@splaro/config'
import type { LegalPageContent } from '@splaro/types'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

function parseLandingContent(row: {
  title: string
  content: string | null
  metaDesc: string | null
  metaTitle: string | null
}): LegalPageContent {
  const fallback: LegalPageContent = {
    title: row.title,
    description: row.metaDesc?.trim() || row.title,
    sections: [{ heading: row.title, body: row.content?.trim() || 'Content coming soon.' }],
    metaTitle: row.metaTitle ?? row.title,
    metaDescription: row.metaDesc ?? row.title,
  }

  if (!row.content) return fallback

  try {
    const parsed = JSON.parse(row.content) as Partial<LegalPageContent>
    if (Array.isArray(parsed.sections) && parsed.sections.length > 0) {
      return {
        title: parsed.title?.trim() || row.title,
        description: parsed.description?.trim() || row.metaDesc || row.title,
        sections: parsed.sections.map((section) => ({
          heading: section.heading?.trim() || 'Section',
          body: section.body?.trim() || '',
        })),
        metaTitle: row.metaTitle ?? parsed.metaTitle ?? parsed.title ?? row.title,
        metaDescription: row.metaDesc ?? parsed.metaDescription ?? parsed.description ?? row.title,
      }
    }
  } catch {
    /* plain text */
  }

  return {
    ...fallback,
    sections: [{ heading: row.title, body: row.content }],
  }
}

export async function getLandingPage(slug: string): Promise<LegalPageContent | null> {
  try {
    const base = getApiBaseUrl()
    const res = await fetch(
      `${base}/storefront/landing-pages/${encodeURIComponent(slug)}?storeId=${encodeURIComponent(STORE_ID)}`,
      { next: { revalidate: 120 } },
    )
    if (!res.ok) return null
    const row = (await res.json()) as {
      title: string
      content: string | null
      metaDesc: string | null
      metaTitle: string | null
    }
    return parseLandingContent(row)
  } catch {
    return null
  }
}
