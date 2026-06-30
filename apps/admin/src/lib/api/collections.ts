import { apiFetch } from './client'

export interface CollectionRow {
  id: string
  name: string
  slug: string
  description?: string | null
  image?: string | null
  isActive: boolean
  _count?: { products: number }
}

export function fetchCollections() {
  return apiFetch<{ collections: CollectionRow[]; total: number }>('/admin/collections')
}

export function createCollection(name: string, description?: string, image?: string) {
  return apiFetch<CollectionRow>('/admin/collections', {
    method: 'POST',
    body: JSON.stringify({ name, description, image }),
  })
}

export function updateCollection(id: string, data: Partial<{ name: string; description: string; image: string; isActive: boolean }>) {
  return apiFetch<CollectionRow>(`/admin/collections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}
