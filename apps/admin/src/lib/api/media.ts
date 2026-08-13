import { apiFetch } from './client'

/**
 * A library folder is free text the store chooses — the API slugifies it. The
 * names below are the buckets every store starts with, offered in the picker
 * alongside whatever folders the store has created.
 */
export type MediaFolder = string

export const BUILT_IN_MEDIA_FOLDERS: Array<{ value: string; label: string }> = [
  { value: 'media', label: 'General / Hero' },
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
  { value: 'kids', label: 'Kids' },
  { value: 'footwear', label: 'Footwear' },
  { value: 'accessories', label: 'Accessories' },
]

export type MediaFolderSummary = {
  name: string
  count: number
  builtIn: boolean
}

/** Same slug rule as the API, so the admin can preview the folder it will create. */
export function normalizeMediaFolder(value: string): string {
  return value
    .trim()
    .slice(0, 40)
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    // Keep Bangla letters and their kars — must match the API's rule exactly.
    .replace(/[^\p{L}\p{N}\p{M}-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function mediaFolderLabel(name: string): string {
  const builtIn = BUILT_IN_MEDIA_FOLDERS.find((folder) => folder.value === name)
  if (builtIn) return builtIn.label
  return name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function fetchMediaFolders() {
  return apiFetch<{ folders: MediaFolderSummary[] }>('/admin/media/folders')
}

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
