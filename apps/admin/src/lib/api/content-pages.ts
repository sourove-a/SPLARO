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

export function fetchSitePages() {
  return apiFetch<SitePageRow[]>('/admin/content/pages?kind=landing')
}

export function createSitePage(input: {
  title: string
  content?: string
  isPublished?: boolean
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
