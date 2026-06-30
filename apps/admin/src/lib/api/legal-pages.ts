import type { LegalPageContent, LegalPageSlug } from '@splaro/types'
import { apiFetch } from './client'

export interface LegalPageRecord extends LegalPageContent {
  slug: LegalPageSlug
  path: string
  label: string
  isCustomized: boolean
  updatedAt: string | null
  id: string | null
}

export type { LegalPageSlug }

export function fetchLegalPages() {
  return apiFetch<LegalPageRecord[]>('/admin/content/legal-pages')
}

export function fetchLegalPage(slug: LegalPageSlug) {
  return apiFetch<LegalPageRecord>(`/admin/content/legal-pages/${slug}`)
}

export function saveLegalPage(slug: LegalPageSlug, body: LegalPageContent) {
  return apiFetch<LegalPageRecord>(`/admin/content/legal-pages/${slug}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}
