import { apiFetch } from './client'

export type MediaFolder = 'media' | 'men' | 'women' | 'kids' | 'footwear' | 'accessories'

export type LibraryMediaAsset = {
  id: string
  storeId: string
  name: string
  path: string
  url: string
  publicUrl: string
  altText: string | null
  folder: MediaFolder
  mimeType: string | null
  sizeBytes: number | null
  width: number | null
  height: number | null
  createdAt: string
  updatedAt: string
}

export type MediaUsage = {
  type:
    | 'product'
    | 'variant'
    | 'hero'
    | 'category'
    | 'collection'
    | 'order'
    | 'store'
    | 'brand'
    | 'blog'
    | 'seo'
    | 'wholesale'
    | 'partner'
    | 'staff'
    | 'content'
    | 'page'
    | 'settings'
    | 'menu'
  id: string
  label: string
}

export function createMediaAsset(data: {
  name: string
  path: string
  altText?: string
  folder: MediaFolder
  mimeType?: string
  sizeBytes?: number
  width?: number | null
  height?: number | null
}) {
  return apiFetch<LibraryMediaAsset>('/admin/media', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateMediaAsset(
  id: string,
  data: { name?: string; altText?: string; folder?: MediaFolder },
) {
  return apiFetch<LibraryMediaAsset>(`/admin/media/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteMediaAsset(id: string) {
  return apiFetch<{ deleted: true; fileDeleted: boolean; id: string; path: string; warning?: string }>(`/admin/media/${id}`, {
    method: 'DELETE',
  })
}

export function deleteOrphanUpload(path: string) {
  return apiFetch<{ deleted: true; path: string }>('/admin/media/orphan', {
    method: 'DELETE',
    body: JSON.stringify({ path }),
  })
}
