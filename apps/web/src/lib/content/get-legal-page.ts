import { getServerApiBaseUrl } from '@splaro/config'
import {
  DEFAULT_LEGAL_PAGES,
  type LegalPageContent,
  type LegalPageSection,
  type LegalPageSlug,
} from '@splaro/types'
import { fetchWithTimeout, isCiOrProductionBuild } from '@/lib/server/build-safe-fetch'
import { pageTitleSegment } from '@/lib/seo/page-title'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

/** Keep newer DEFAULT trust sections when admin CMS is stale (missing headings). */
function mergeLegalSections(
  apiSections: LegalPageSection[],
  fallbackSections: LegalPageSection[],
): LegalPageSection[] {
  if (!apiSections.length) return fallbackSections
  const headings = new Set(apiSections.map((s) => s.heading.trim().toLowerCase()))
  const missing = fallbackSections.filter((s) => !headings.has(s.heading.trim().toLowerCase()))
  if (!missing.length) return apiSections

  const merged = [...apiSections]
  for (const section of missing) {
    const idx = fallbackSections.findIndex(
      (s) => s.heading.trim().toLowerCase() === section.heading.trim().toLowerCase(),
    )
    const before = idx > 0 ? fallbackSections[idx - 1] : null
    const insertAt = before
      ? merged.findIndex((s) => s.heading.trim().toLowerCase() === before.heading.trim().toLowerCase()) + 1
      : merged.length
    merged.splice(insertAt > 0 ? insertAt : merged.length, 0, section)
  }
  return merged
}

export async function getLegalPage(slug: LegalPageSlug): Promise<LegalPageContent> {
  const fallback = DEFAULT_LEGAL_PAGES[slug]

  if (isCiOrProductionBuild()) {
    return fallback
  }

  try {
    const base = getServerApiBaseUrl()
    const res = await fetchWithTimeout(
      `${base}/storefront/legal-pages/${encodeURIComponent(slug)}?storeId=${encodeURIComponent(STORE_ID)}`,
      { next: { revalidate: 120 } },
    )
    if (!res?.ok) return fallback

    const data = (await res.json()) as LegalPageContent
    const sections = mergeLegalSections(data.sections ?? [], fallback.sections)
    return {
      title: data.title?.trim() || fallback.title,
      description: data.description?.trim() || fallback.description,
      sections: sections.length ? sections : fallback.sections,
      metaTitle: pageTitleSegment(data.metaTitle ?? fallback.metaTitle) || data.title?.trim() || fallback.title,
      metaDescription:
        data.metaDescription ?? fallback.metaDescription ?? data.description ?? fallback.description,
    }
  } catch {
    return fallback
  }
}
