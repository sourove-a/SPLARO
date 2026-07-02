import { getApiBaseUrl } from '@splaro/config'
import {
  DEFAULT_LEGAL_PAGES,
  type LegalPageContent,
  type LegalPageSlug,
} from '@splaro/types'
import { fetchWithTimeout, isCiOrProductionBuild } from '@/lib/server/build-safe-fetch'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

export async function getLegalPage(slug: LegalPageSlug): Promise<LegalPageContent> {
  const fallback = DEFAULT_LEGAL_PAGES[slug]

  if (isCiOrProductionBuild()) {
    return fallback
  }

  try {
    const base = getApiBaseUrl()
    const res = await fetchWithTimeout(
      `${base}/storefront/legal-pages/${encodeURIComponent(slug)}?storeId=${encodeURIComponent(STORE_ID)}`,
      { next: { revalidate: 120 } },
    )
    if (!res?.ok) return fallback

    const data = (await res.json()) as LegalPageContent
    return {
      title: data.title?.trim() || fallback.title,
      description: data.description?.trim() || fallback.description,
      sections: data.sections?.length ? data.sections : fallback.sections,
      metaTitle: data.metaTitle ?? fallback.metaTitle ?? data.title ?? fallback.title,
      metaDescription:
        data.metaDescription ?? fallback.metaDescription ?? data.description ?? fallback.description,
    }
  } catch {
    return fallback
  }
}
