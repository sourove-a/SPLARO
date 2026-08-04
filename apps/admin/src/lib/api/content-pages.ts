import { apiFetch } from './client'

export interface SitePageRow {
  id: string
  title: string
  slug: string
  content: string | null
  isPublished: boolean
  isHomepage: boolean
  metaTitle: string | null
  metaDesc: string | null
  createdAt: string
  updatedAt: string
}

/** Landing = campaign pages (excludes homepage + legal slugs server-side). */
export function fetchLandingPages() {
  return apiFetch<SitePageRow[]>('/admin/content/pages?kind=landing')
}

/** All site pages — caller filters legal slugs for CMS. */
export function fetchAllSitePages() {
  return apiFetch<SitePageRow[]>('/admin/content/pages')
}

/** @deprecated Prefer fetchLandingPages — kept for existing hooks. */
export function fetchSitePages() {
  return fetchLandingPages()
}

export function createSitePage(input: {
  title: string
  content?: string
  isPublished?: boolean
  isHomepage?: boolean
  metaTitle?: string
  metaDesc?: string
}) {
  return apiFetch<SitePageRow>('/admin/content/pages', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateSitePage(
  id: string,
  input: Partial<{
    title: string
    slug: string
    content: string
    isPublished: boolean
    metaTitle: string
    metaDesc: string
  }>,
) {
  return apiFetch<SitePageRow>(`/admin/content/pages/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteSitePage(id: string) {
  return apiFetch<{ deleted: boolean }>(`/admin/content/pages/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
