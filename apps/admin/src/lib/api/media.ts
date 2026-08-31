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
  label?: string
  count: number
  /** Indexed bytes only — the derivative-aware total comes from `fetchMediaStorage`. */
  bytes?: number
  builtIn: boolean
  parentSlug?: string | null
}

export type MediaFolderNode = MediaFolderSummary & {
  children: MediaFolderNode[]
  totalCount: number
  totalBytes: number
}

/** Same slug rule as the API, so the admin can preview the folder it will create. */
export function normalizeMediaFolder(value: string): string {
  const parts = value
    .trim()
    .slice(0, 80)
    .split('/')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[^\p{L}\p{N}\p{M}-]/gu, '')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, ''),
    )
    .filter(Boolean)
  return parts.join('/')
}

export function mediaFolderFromSelection(value: string): MediaFolder {
  if (value === 'all') return 'media'
  if (value.startsWith('products-')) return value.slice('products-'.length) || 'media'
  if (value === 'products') return 'media'
  return value
}

export function mediaFolderLabel(name: string): string {
  const builtIn = BUILT_IN_MEDIA_FOLDERS.find((folder) => folder.value === name)
  if (builtIn) return builtIn.label
  return name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function folderChipLabel(folder: MediaFolderSummary): string {
  return folder.label?.trim() || mediaFolderLabel(folder.name)
}

export function fetchMediaFolders() {
  return apiFetch<{ folders: MediaFolderSummary[]; tree?: MediaFolderNode[] }>('/admin/media/folders')
}

export function createMediaFolder(label: string, parentSlug?: string) {
  return apiFetch<MediaFolderSummary>('/admin/media/folders', {
    method: 'POST',
    body: JSON.stringify({ label, ...(parentSlug ? { parentSlug } : {}) }),
  })
}

export function renameMediaFolder(slug: string, label: string) {
  return apiFetch<{ name: string; label: string; previous: string }>(
    `/admin/media/folders/${encodeURIComponent(slug)}`,
    { method: 'PATCH', body: JSON.stringify({ label }) },
  )
}

export function deleteMediaFolder(slug: string) {
  return apiFetch<{ deleted: true; slug: string }>(`/admin/media/folders/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
  })
}

export type MediaStorage = {
  volume: {
    path: string
    totalBytes: number
    freeBytes: number
    usedBytes: number
    /** Configured plan size — `statfs` reports the whole host volume on a VPS. */
    quotaBytes: number | null
  } | null
  /** Measured by walking the upload root; `available: false` means the walk failed. */
  disk: {
    bytes: number
    files: number
    available: boolean
    truncated: boolean
    scannedAt: string
  } | null
  /** Indexed uploads plus the derivatives written beside them. */
  libraryBytes: number
  libraryAssets: number
  split: {
    indexedBytes: number
    derivativeBytes: number
    trashBytes: number
    orphanBytes: number
    orphanFiles: number
    trashAssets: number
  }
  byFolder: Array<{ slug: string; label: string; bytes: number; count: number }>
  byType: Array<{ kind: string; bytes: number; count: number }>
  byMonth: Array<{
    month: string
    bytes: number
    count: number
    cumulativeBytes: number
    cumulativeAssets: number
  }>
  largest: Array<{
    id: string
    name: string
    path: string
    url: string
    publicUrl: string
    folder: string
    kind: string
    bytes: number
  }>
}

export function fetchMediaStorage(refresh = false) {
  return apiFetch<MediaStorage>(`/admin/media/storage${refresh ? '?refresh=1' : ''}`)
}

export type MediaOrphan = {
  familyKey: string
  /** The path to hand back to the purge endpoint. */
  path: string
  paths: string[]
  bytes: number
  files: number
  modifiedAt: string
  pending: boolean
  /** False while an upload may still be in flight. */
  purgeSafe: boolean
}

export function fetchMediaOrphans(options: { refresh?: boolean; limit?: number } = {}) {
  const params = new URLSearchParams()
  if (options.refresh) params.set('refresh', '1')
  if (options.limit) params.set('limit', String(options.limit))
  const suffix = params.toString()
  return apiFetch<{
    orphans: MediaOrphan[]
    total: number
    totalBytes: number
    returned: number
    scannedAt: string
    available: boolean
    truncated: boolean
  }>(`/admin/media/orphans${suffix ? `?${suffix}` : ''}`)
}

export function purgeMediaOrphans(paths: string[]) {
  return apiFetch<{ results: Array<{ path: string; ok: boolean; error?: string }>; deleted: number }>(
    '/admin/media/orphans/purge',
    { method: 'POST', body: JSON.stringify({ paths }) },
  )
}

export function moveMediaAssets(ids: string[], folder: string) {
  return apiFetch<{ moved: number; folder: string }>('/admin/media/bulk-move', {
    method: 'POST',
    body: JSON.stringify({ ids, folder }),
  })
}

/** Permanent delete for many assets at once — files included, no trash step. */
export function purgeMediaAssets(ids: string[]) {
  return apiFetch<{
    results: Array<{ id: string; ok: boolean; error?: string; usage?: MediaUsage[] }>
    deleted: number
  }>('/admin/media/bulk-purge', { method: 'POST', body: JSON.stringify({ ids }) })
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
  contentHash?: string | null
  kind?: string | null
  focalX?: number | null
  focalY?: number | null
  watermarked?: boolean
  deletedAt?: string | null
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
  contentHash?: string
  kind?: string
  watermarked?: boolean
}) {
  return apiFetch<LibraryMediaAsset>('/admin/media', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateMediaAsset(
  id: string,
  data: {
    name?: string
    altText?: string
    folder?: MediaFolder
    focalX?: number | null
    focalY?: number | null
  },
) {
  return apiFetch<LibraryMediaAsset>(`/admin/media/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function fetchLibraryMedia(query: { trash?: boolean; duplicates?: boolean; q?: string; folder?: string } = {}) {
  const params = new URLSearchParams()
  if (query.trash) params.set('trash', '1')
  if (query.duplicates) params.set('duplicates', '1')
  if (query.q?.trim()) params.set('q', query.q.trim())
  if (query.folder && query.folder !== 'all') params.set('folder', query.folder)
  const suffix = params.toString()
  return apiFetch<{ assets: LibraryMediaAsset[]; total: number }>(`/admin/media${suffix ? `?${suffix}` : ''}`)
}

export function fetchMediaUsage(id: string) {
  return apiFetch<{ id: string; path: string; usage: MediaUsage[] }>(`/admin/media/${id}/usage`)
}

/**
 * Every image URL the rest of the catalogue points at, for pickers that hide
 * them. `exceptProductId` leaves the product being edited out of the answer.
 */
export function fetchProductUsagePaths(exceptProductId?: string) {
  const suffix = exceptProductId ? `?exceptProductId=${encodeURIComponent(exceptProductId)}` : ''
  return apiFetch<{ paths: string[] }>(`/admin/media/product-usage${suffix}`)
}

export function fetchMediaUsageByPath(path: string) {
  return apiFetch<{ path: string; usage: MediaUsage[] }>(`/admin/media/usage?path=${encodeURIComponent(path)}`)
}

export function restoreMediaAsset(id: string) {
  return apiFetch<LibraryMediaAsset & { restored: boolean }>(`/admin/media/${id}/restore`, { method: 'POST' })
}

export function emptyMediaTrash() {
  return apiFetch<{ deleted: number; files: number }>('/admin/media/trash', { method: 'DELETE' })
}

export function bulkDeleteMediaAssets(ids: string[]) {
  return apiFetch<{ results: Array<{ id: string; ok: boolean; error?: string; usage?: MediaUsage[] }> }>(
    '/admin/media/bulk-delete',
    { method: 'POST', body: JSON.stringify({ ids }) },
  )
}

export function replaceMediaAsset(
  id: string,
  data: {
    path: string
    mimeType?: string
    sizeBytes?: number
    width?: number | null
    height?: number | null
    contentHash?: string
    kind?: string
  },
) {
  return apiFetch<LibraryMediaAsset>(`/admin/media/${id}/replace`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/** Without `permanent`, the first delete only moves the asset to trash. */
export function deleteMediaAsset(id: string, options: { permanent?: boolean } = {}) {
  return apiFetch<{ deleted: true; trashed?: boolean; fileDeleted: boolean; id: string; path: string; warning?: string }>(
    `/admin/media/${id}${options.permanent ? '?permanent=1' : ''}`,
    { method: 'DELETE' },
  )
}

export function deleteOrphanUpload(path: string) {
  return apiFetch<{ deleted: true; path: string }>('/admin/media/orphan', {
    method: 'DELETE',
    body: JSON.stringify({ path }),
  })
}
