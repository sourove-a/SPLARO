'use client'

/* eslint-disable @next/next/no-img-element -- blob previews and runtime public upload URLs */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { DcContentNav } from '@/components/dc/DcContentNav'
import { DcIcon } from '@/components/dc/DcIcon'
import { DcModal } from '@/components/dc/DcModal'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcFolderRail, foldersToTree } from '@/components/dc/media/DcFolderRail'
import { DcMediaLightbox } from '@/components/dc/media/DcMediaLightbox'
import { DcDuplicateGroups, DcOrphanPane } from '@/components/dc/media/DcMaintenancePanes'
import { formatBytes } from '@/components/dc/media/DcStoragePanel'
import { DcUploadQueue } from '@/components/dc/media/DcUploadQueue'
import { DcStoragePanel } from '@/components/dc/media/DcStoragePanel'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, toneStyle } from '@/components/dc/tokens'
import { resolutionGrade } from '@/lib/media/asset-meta'
import { useCategories, useMedia, useMediaFolders, useMediaStorage, useProducts } from '@/lib/api/hooks'
import {
  bulkDeleteMediaAssets,
  createMediaAsset,
  createMediaFolder,
  deleteMediaAsset,
  deleteMediaFolder,
  emptyMediaTrash,
  fetchLibraryMedia,
  fetchMediaUsage,
  moveMediaAssets,
  purgeMediaAssets,
  renameMediaFolder,
  replaceMediaAsset,
  restoreMediaAsset,
  BUILT_IN_MEDIA_FOLDERS,
  folderChipLabel,
  mediaFolderLabel,
  normalizeMediaFolder,
  updateMediaAsset,
  type LibraryMediaAsset,
  type MediaFolder,
  type MediaFolderSummary,
  type MediaUsage,
} from '@/lib/api/media'
import { ApiError } from '@/lib/api/client'
import { deleteBanner, updateBanner } from '@/lib/api/banners'
import { updateCategory } from '@/lib/api/categories'
import { fetchMedia } from '@/lib/api/platform'
import { addProductImage, deleteProductImage, fetchProduct } from '@/lib/api/products'
import { readImageDimensions, uploadAdminImage } from '@/lib/api/upload'
import { resolveMediaUrl } from '@/lib/media-url'
import {
  ALLOWED_UPLOAD_TYPES,
  cleanupOrphanWithRetry,
  delay,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  RASTER_UPLOAD,
} from '@/lib/media/upload-rules'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { type MediaDeptFolder } from '@/lib/admin/size-presets'
import { heroMediaPreviewSrc } from '@splaro/config'
import '@/styles/dc-media-library.css'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const capsLabel = {
  font: `600 11px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
}

const iconButton = {
  border: 0,
  background: 'transparent',
  color: 'var(--ink-3)',
  cursor: 'pointer',
  padding: 4,
} as const

const modalInput = {
  width: '100%',
  height: 38,
  borderRadius: 9,
  border: '1px solid var(--line)',
  background: 'var(--surface-2)',
  color: 'var(--ink)',
  padding: '0 10px',
  font: `500 13px/1 ${FONT}`,
  boxSizing: 'border-box',
} as const

const FILTERS = ['All', 'Library', 'Product', 'Banner', 'Category'] as const
type Filter = (typeof FILTERS)[number]

type MediaAsset = {
  id: string
  type: string
  name: string
  url: string
  altText: string
  source: string
  updated: string
  productId?: string
  productSlug?: string
  publicUrl?: string
  folder?: string
  mimeType?: string | null
  sizeBytes?: number | null
  width?: number | null
  height?: number | null
  contentHash?: string | null
  kind?: string | null
  focalX?: number | null
  focalY?: number | null
  createdAt?: string
  updatedAt?: string
}


const DEPT_FOLDERS = new Set(['men', 'women', 'kids', 'footwear', 'accessories'])

function libraryFolderFromChip(value: string): string {
  if (value === 'all') return 'all'
  if (value.startsWith('products-')) return value.slice('products-'.length) || 'media'
  if (value === 'products') return 'media'
  return value
}

/**
 * Library folder → the folder the file physically lands in. Only the five
 * department buckets have a matching product directory on disk; a folder the
 * store invented is a library label, so its files go to the default product
 * directory rather than a path the upload endpoint would reject.
 */
function productFolder(folder: MediaFolder): MediaDeptFolder {
  return DEPT_FOLDERS.has(folder) ? (`products-${folder}` as MediaDeptFolder) : 'products'
}

const NEW_FOLDER_OPTION = '__new__'

/**
 * Folder picker that can also create one. The store's existing folders come
 * from the API; picking "New folder…" swaps in a text field and reports the
 * slugified name up as it is typed, so the caller always holds the exact value
 * the API will store.
 */
function FolderSelect({
  value,
  onChange,
  folders,
  selectStyle,
  inputStyle,
}: {
  value: MediaFolder
  onChange: (next: MediaFolder) => void
  folders: MediaFolderSummary[]
  selectStyle: CSSProperties
  inputStyle: CSSProperties
}) {
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')

  const options = useMemo(() => {
    const names = folders.map((folder) => folder.name)
    // Keep the current value selectable even before the folder list resolves.
    return [...new Set(value ? [...names, value] : names)]
  }, [folders, value])

  const slug = normalizeMediaFolder(draft)

  if (creating) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          autoFocus
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            onChange(normalizeMediaFolder(event.target.value))
          }}
          placeholder="Eid Campaign"
          maxLength={40}
          style={inputStyle}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={{ font: `400 11px/1.4 ${FONT}`, color: slug ? 'var(--ink-3)' : 'var(--bad)' }}>
            {slug ? `Saved as “${slug}”` : 'Enter a folder name'}
          </span>
          <button
            type="button"
            onClick={() => {
              setCreating(false)
              setDraft('')
              onChange(options[0] ?? 'media')
            }}
            style={{
              border: 'none',
              background: 'none',
              padding: 0,
              cursor: 'pointer',
              font: `600 11px/1 ${FONT}`,
              color: 'var(--violet)',
            }}
          >
            Pick an existing folder
          </button>
        </div>
      </div>
    )
  }

  return (
    <select
      value={value}
      onChange={(event) => {
        if (event.target.value === NEW_FOLDER_OPTION) {
          setCreating(true)
          setDraft('')
          onChange('')
          return
        }
        onChange(event.target.value)
      }}
      style={selectStyle}
    >
      {options.map((name) => (
        <option key={name} value={name}>
          {mediaFolderLabel(name)}
        </option>
      ))}
      <option value={NEW_FOLDER_OPTION}>+ New folder…</option>
    </select>
  )
}

function assetOwnerHref(asset: MediaAsset): string | null {
  const type = asset.type.toLowerCase()
  if (type === 'product' && asset.productId) return `/dashboard/products/${asset.productId}/edit`
  if (type === 'banner') return '/dashboard/hero-slider'
  if (type === 'category') return '/dashboard/categories'
  return null
}

function usageFromError(error: unknown): MediaUsage[] {
  if (!(error instanceof ApiError) || !error.body) return []
  try {
    const body = JSON.parse(error.body) as { usage?: MediaUsage[]; message?: { usage?: MediaUsage[] } }
    return body.usage ?? body.message?.usage ?? []
  } catch {
    return []
  }
}

export function DcMediaLibrary() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="media" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcMediaLibraryBody />
    </DcScreenProvider>
  )
}

function DcMediaLibraryBody() {
  const router = useRouter()
  const { toast } = useDcScreen()
  const qc = useQueryClient()
  const products = useProducts({ limit: 100 })
  const { api } = useAdminConnection(25_000)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadAbortRef = useRef<AbortController | null>(null)
  const dragIdsRef = useRef<string[]>([])
  const searchRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Array<HTMLElement | null>>([])
  /** Roving tabindex cursor — one card in the grid is tabbable at a time. */
  const [focusIndex, setFocusIndex] = useState(0)
  const suppressPreviewRef = useRef(false)

  const [filter, setFilter] = useState<Filter>('All')
  const [deptFolder, setDeptFolder] = useState('all')
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderLabel, setNewFolderLabel] = useState('')
  const [query, setQuery] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploadFolder, setUploadFolder] = useState<MediaFolder>('media')
  const [uploadName, setUploadName] = useState('')
  const [uploadAlt, setUploadAlt] = useState('')
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadDimensions, setUploadDimensions] = useState<{ width: number; height: number } | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'optimizing' | 'indexing'>('idle')
  const [attachProductId, setAttachProductId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null)
  const [deleteUsage, setDeleteUsage] = useState<MediaUsage[]>([])
  const [editTarget, setEditTarget] = useState<MediaAsset | null>(null)
  const [editName, setEditName] = useState('')
  const [editAlt, setEditAlt] = useState('')
  const [editFolder, setEditFolder] = useState<MediaFolder>('media')
  const [editFocal, setEditFocal] = useState<{ x: number; y: number } | null>(null)
  const [libraryPane, setLibraryPane] = useState<'live' | 'trash' | 'duplicates' | 'orphans'>('live')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [sortKey, setSortKey] = useState<'updated' | 'name' | 'size'>('updated')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dropActive, setDropActive] = useState(false)
  const [watermarkUpload, setWatermarkUpload] = useState(false)
  const [nestUnder, setNestUnder] = useState(false)
  /** Folder the rail asked to nest a new folder under, overriding the checkbox. */
  const [createParent, setCreateParent] = useState<string | null>(null)
  /** Files picked in one go — a batch skips the single-file modal for a queue. */
  const [queueFiles, setQueueFiles] = useState<File[]>([])
  const [queueBusy, setQueueBusy] = useState(false)
  const [renameFolderOpen, setRenameFolderOpen] = useState(false)
  const [renameFolderLabel, setRenameFolderLabel] = useState('')
  const [cropTarget, setCropTarget] = useState<MediaAsset | null>(null)
  const [bannerEdit, setBannerEdit] = useState<MediaAsset | null>(null)
  const [bannerTitle, setBannerTitle] = useState('')
  const [bannerSubtitle, setBannerSubtitle] = useState('')
  const [bannerLink, setBannerLink] = useState('')
  const [categoryEdit, setCategoryEdit] = useState<MediaAsset | null>(null)
  const [categoryName, setCategoryName] = useState('')
  const [usageInspect, setUsageInspect] = useState<{ asset: MediaAsset; usage: MediaUsage[] } | null>(null)
  const [previewKey, setPreviewKey] = useState<{ type: string; id: string } | null>(null)
  const deferredQuery = useDebouncedValue(query)
  const mediaType = filter.toLowerCase() as 'all' | 'library' | 'product' | 'banner' | 'category'
  const mediaFolder = libraryFolderFromChip(deptFolder)
  const media = useMedia({ limit: 60, q: deferredQuery, type: mediaType, folder: mediaFolder })
  const folderQuery = useMediaFolders()
  const trashQuery = useQuery({
    queryKey: ['media-trash', deferredQuery],
    queryFn: () => fetchLibraryMedia({ trash: true, q: deferredQuery }),
    enabled: true,
    staleTime: 10_000,
  })
  const dupeQuery = useQuery({
    queryKey: ['media-dupes', deferredQuery, mediaFolder],
    queryFn: () => fetchLibraryMedia({ duplicates: true, q: deferredQuery, folder: mediaFolder }),
    enabled: true,
    staleTime: 10_000,
  })
  const libraryFolders = useMemo(
    () => folderQuery.data?.folders ?? BUILT_IN_MEDIA_FOLDERS.map((f) => ({ name: f.value, count: 0, builtIn: true })),
    [folderQuery.data],
  )
  const selectedLibraryFolder =
    mediaFolder === 'all' ? null : libraryFolders.find((folder) => folder.name === mediaFolder)
  // An API without the nested `tree` field — or one that answers with an empty
  // one while folders exist — still has to fill the rail, so rebuild from the
  // flat list unless the server sent real nodes.
  const folderTree = useMemo(() => {
    const served = folderQuery.data?.tree
    return served && served.length > 0 ? served : foldersToTree(libraryFolders)
  }, [folderQuery.data?.tree, libraryFolders])
  const categories = useCategories()
  /**
   * Category names the library has no folder for yet. The rail offers them as
   * one-click folders so the media tree can mirror the storefront menu instead
   * of being typed out a second time.
   */
  const folderSuggestions = useMemo(() => {
    const existing = new Set(libraryFolders.map((folder) => folder.name))
    const seen = new Set<string>()
    return (categories.data ?? [])
      .filter((category) => category.isActive !== false)
      .map((category) => category.name.trim())
      .filter((name) => {
        if (!name) return false
        const slug = normalizeMediaFolder(name)
        if (!slug || existing.has(slug) || seen.has(slug)) return false
        seen.add(slug)
        return true
      })
      .slice(0, 8)
  }, [categories.data, libraryFolders])

  useEffect(() => {
    if (!pendingFile) {
      setUploadPreview(null)
      setUploadDimensions(null)
      return
    }
    const preview = URL.createObjectURL(pendingFile)
    setUploadPreview(preview)
    return () => URL.revokeObjectURL(preview)
  }, [pendingFile])

  const resetUploadModal = () => {
    setPendingFile(null)
    setUploadFolder('media')
    setUploadName('')
    setUploadAlt('')
    setUploadProgress(0)
    setUploadPhase('idle')
    setAttachProductId('')
  }

  const stats = media.data?.pages[0]?.stats
  const liveAssets = useMemo(
    () => (media.data?.pages.flatMap((page) => page.assets) ?? []) as MediaAsset[],
    [media.data],
  )
  const assets = useMemo(() => {
    const toCard = (
      asset: LibraryMediaAsset,
      source: string,
    ): MediaAsset => ({
      id: asset.id,
      type: 'library',
      name: asset.name,
      url: asset.path,
      altText: asset.altText ?? '',
      source,
      updated: source,
      folder: asset.folder,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
      ...(asset.contentHash != null ? { contentHash: asset.contentHash } : {}),
      ...(asset.kind != null ? { kind: asset.kind } : {}),
      ...(asset.focalX != null ? { focalX: asset.focalX } : {}),
      ...(asset.focalY != null ? { focalY: asset.focalY } : {}),
      ...(asset.publicUrl ? { publicUrl: asset.publicUrl } : {}),
      ...(asset.createdAt ? { createdAt: asset.createdAt } : {}),
      ...(asset.updatedAt ? { updatedAt: asset.updatedAt } : {}),
    })
    if (libraryPane === 'trash') {
      return (trashQuery.data?.assets ?? []).map((asset: LibraryMediaAsset) => {
        const days = asset.deletedAt
          ? Math.floor((Date.now() - new Date(asset.deletedAt).getTime()) / 86_400_000)
          : null
        return toCard(asset, days === null ? 'Trash' : days < 1 ? 'Trashed today' : `In trash ${days}d`)
      })
    }
    if (libraryPane === 'duplicates') return (dupeQuery.data?.assets ?? []).map((asset: LibraryMediaAsset) => toCard(asset, 'Duplicate'))
    return liveAssets
  }, [libraryPane, trashQuery.data, dupeQuery.data, liveAssets])
  const productOptions = products.data?.products ?? []
  const rows = useMemo(() => {
    const copy = [...assets]
    if (sortKey === 'name') copy.sort((a, b) => a.name.localeCompare(b.name))
    if (sortKey === 'size') copy.sort((a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0))
    return copy
  }, [assets, sortKey])

  const pageStatus = dcPageStatus([media], api.pulse)

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['platform-media'] })
    void qc.invalidateQueries({ queryKey: ['media-folders'] })
    void qc.invalidateQueries({ queryKey: ['media-storage'] })
    void qc.invalidateQueries({ queryKey: ['media-trash'] })
    void qc.invalidateQueries({ queryKey: ['media-dupes'] })
    void qc.invalidateQueries({ queryKey: ['admin-banners'] })
    void qc.invalidateQueries({ queryKey: ['admin-categories'] })
    void media.refetch()
  }

  /**
   * One file still gets the modal — it can be named, alt-texted and attached to
   * a product. Two or more is a batch: those settings do not apply per file, so
   * they go to the queue instead.
   */
  const selectUploadFiles = async (picked: File[]) => {
    const files = picked.filter(Boolean)
    if (files.length === 0) return
    if (files.length === 1 && files[0]) {
      await selectUploadFile(files[0])
      return
    }
    setQueueFiles(files)
  }

  const selectUploadFile = async (file: File) => {
    if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
      toast('bad', 'Unsupported file', 'JPG, PNG, WebP, GIF, AVIF, SVG, PDF, MP4 or WebM.')
      return
    }
    const isRaster = RASTER_UPLOAD.has(file.type)
    if (file.size > MAX_UPLOAD_BYTES) {
      toast('bad', 'File is too large', `Maximum upload size is ${MAX_UPLOAD_LABEL}.`)
      return
    }
    try {
      let dimensions: { width: number; height: number } | null = null
      if (isRaster || file.type === 'image/svg+xml') {
        dimensions = await readImageDimensions(file)
        if (dimensions.width < 1 || dimensions.height < 1) throw new Error('Invalid image dimensions')
      }
      setAttachProductId('')
      const logicalFolder = deptFolder === 'all'
        ? 'media'
        : (deptFolder.replace(/^products-?/, '') || 'media') as MediaFolder
      setUploadFolder(logicalFolder)
      setUploadName(file.name.replace(/\.[^.]+$/, '') || '')
      setUploadAlt(file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') || '')
      setUploadDimensions(dimensions)
      setPendingFile(file)
    } catch {
      toast('bad', 'Unreadable file', 'Browser could not decode this file. Choose another supported format.')
    }
  }

  const uploadMut = useMutation({
    mutationFn: async ({
      file,
      productId,
      folder,
      name,
      altText,
    }: {
      file: File
      productId: string | null
      folder: MediaFolder
      name: string
      altText: string
    }) => {
      const displayName = name.trim() || file.name.replace(/\.[^.]+$/, '') || 'Library asset'
      if (productId && !new Set(['image/jpeg', 'image/png', 'image/webp']).has(file.type)) {
        throw new Error('Product gallery only accepts JPG, PNG or WebP.')
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error(`Uploads must be ${MAX_UPLOAD_LABEL} or smaller.`)
      }
      setUploadPhase('uploading')
      setUploadProgress(0)
      const uploadFolderName = productId ? productFolder(folder) : 'media'
      const uploadId = `${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
      const controller = new AbortController()
      uploadAbortRef.current = controller
      let uploadedUrl: string | null = null
      let committed = false
      try {
        const uploaded = await uploadAdminImage(file, uploadFolderName, {
          signal: controller.signal,
          uploadId,
          watermark: !productId && watermarkUpload,
          optimize: RASTER_UPLOAD.has(file.type) && file.type !== 'image/gif',
          onProgress: (percent) => {
            setUploadProgress(percent)
            if (percent >= 100) setUploadPhase('optimizing')
          },
        })
        uploadedUrl = uploaded.url
        setUploadPhase('indexing')

        if (productId) {
          await addProductImage(productId, {
            url: uploaded.url,
            altText: altText.trim() || displayName,
          })
          committed = true
          let verified = false
          for (let attempt = 0; attempt < 3 && !verified; attempt += 1) {
            if (attempt > 0) await delay(450 * attempt)
            try {
              const product = await fetchProduct(productId)
              verified = Boolean(product.images?.some((image) => image.url === uploaded.url))
            } catch {
              // Fresh read is retried below; attachment API already confirmed persistence.
            }
          }
          return { mode: 'product' as const, url: uploaded.url, folder, name: displayName, verified }
        }

        const indexed = await createMediaAsset({
          name: displayName,
          path: uploaded.url,
          altText: altText.trim() || displayName,
          folder,
          ...(uploaded.mimeType ? { mimeType: uploaded.mimeType } : {}),
          ...(uploaded.sizeBytes !== undefined ? { sizeBytes: uploaded.sizeBytes } : {}),
          ...(uploaded.width !== undefined ? { width: uploaded.width } : {}),
          ...(uploaded.height !== undefined ? { height: uploaded.height } : {}),
          ...(uploaded.contentHash ? { contentHash: uploaded.contentHash } : {}),
          ...(uploaded.kind ? { kind: uploaded.kind } : {}),
          ...(uploaded.watermarked ? { watermarked: true } : {}),
        })
        committed = true
        let verified = false
        for (let attempt = 0; attempt < 3 && !verified; attempt += 1) {
          if (attempt > 0) await delay(450 * attempt)
          try {
            const fresh = await fetchMedia({ limit: 10, q: uploaded.url, type: 'library' })
            verified = fresh.assets.some((asset) => asset.id === indexed.id && asset.url === uploaded.url)
          } catch {
            // Fresh read is retried; do not turn a persisted asset into a duplicate upload.
          }
        }
        return { mode: 'library' as const, url: uploaded.url, folder, name: displayName, verified }
      } catch (error) {
        if (!committed) {
          const cleanupPath = uploadedUrl ?? `/uploads/${uploadFolderName}/${uploadId}.webp`
          try {
            await cleanupOrphanWithRetry(cleanupPath)
          } catch {
            const message = error instanceof Error ? error.message : 'Upload failed'
            throw new Error(`${message} Orphan cleanup also needs attention.`)
          }
        }
        throw error
      } finally {
        if (uploadAbortRef.current === controller) uploadAbortRef.current = null
      }
    },
    onSuccess: (res) => {
      resetUploadModal()
      setDeptFolder(res.mode === 'product' ? productFolder(res.folder) : res.folder)
      invalidate()
      if (!res.verified) {
        toast(
          'warn',
          'Saved · verification pending',
          'Server accepted the image. Refresh Media Library before uploading it again.',
        )
        return
      }
      toast(
        'ok',
        res.mode === 'product' ? 'Image attached to product' : 'Saved to media library',
        `${res.name} · ${res.folder}`,
      )
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Could not upload image'
      if (message === 'Upload cancelled') {
        resetUploadModal()
        toast('info', 'Upload cancelled', 'No successful save was reported.')
        return
      }
      toast('bad', 'Upload failed', message)
    },
  })

  const deleteMut = useMutation({
    mutationFn: async (asset: MediaAsset) => {
      const type = (asset.type ?? '').toLowerCase()
      if (type === 'library') {
        return deleteMediaAsset(asset.id)
      }
      if (type === 'product') {
        if (!asset.productId) {
          throw new Error('Open the product editor to remove this image')
        }
        return deleteProductImage(asset.productId, asset.id)
      }
      if (type === 'banner') {
        return deleteBanner(asset.id)
      }
      if (type === 'category') {
        return updateCategory(asset.id, { image: null })
      }
      throw new Error(`${type || 'unknown'} assets must be changed from their owner module`)
    },
    onSuccess: (result, asset) => {
      setDeleteTarget(null)
      invalidate()
      const type = (asset.type ?? '').toLowerCase()
      const warning =
        result && 'warning' in result && typeof result.warning === 'string' ? result.warning : undefined
      if (type === 'product') {
        toast(
          warning ? 'warn' : 'ok',
          'Image removed from product',
          warning ?? 'Live catalog refresh is queued. The product itself was not deleted.',
        )
        return
      }
      if (result && 'trashed' in result && result.trashed) {
        toast('ok', 'Moved to trash', 'Restore from Trash, or delete again to remove the file.')
        return
      }
      if (result && 'fileDeleted' in result && result.fileDeleted === false) {
        toast('warn', 'Media removed from library', warning ?? 'Physical file cleanup needs attention.')
        return
      }
      toast('ok', 'Removed', 'Asset deleted from the catalogue index.')
    },
    onError: (err) => {
      const usage = usageFromError(err)
      if (usage.length > 0) {
        setDeleteUsage(usage)
        toast('warn', 'Image is still linked', 'Unlink every usage before deleting this file.')
        return
      }
      toast('bad', 'Delete failed', err instanceof Error ? err.message : 'Could not delete asset')
    },
  })

  const createFolderMut = useMutation({
    mutationFn: ({ label, parentSlug }: { label: string; parentSlug?: string | undefined }) =>
      createMediaFolder(label, parentSlug),
    onSuccess: (folder) => {
      setCreateParent(null)
      setNewFolderOpen(false)
      setNewFolderLabel('')
      setDeptFolder(folder.name)
      invalidate()
      toast('ok', 'Folder ready', folder.builtIn ? folderChipLabel(folder) : `${folderChipLabel(folder)} · ${folder.name}`)
    },
    onError: (err) => toast('bad', 'Could not create folder', err instanceof Error ? err.message : 'POST /admin/media/folders failed'),
  })

  /** Folder a new folder should nest under, from the rail or the modal checkbox. */
  const pendingParentSlug =
    createParent ??
    (nestUnder && selectedLibraryFolder && !selectedLibraryFolder.builtIn
      ? selectedLibraryFolder.name
      : undefined)

  const moveMut = useMutation({
    mutationFn: ({ ids, folder }: { ids: string[]; folder: string }) => moveMediaAssets(ids, folder),
    onSuccess: (res) => {
      setSelectedIds(new Set())
      invalidate()
      toast(
        'ok',
        `Moved ${res.moved} file${res.moved === 1 ? '' : 's'}`,
        `Now filed under ${mediaFolderLabel(res.folder)}.`,
      )
    },
    onError: (err) =>
      toast('bad', 'Move failed', err instanceof Error ? err.message : 'POST /admin/media/bulk-move failed'),
  })

  const deleteFolderMut = useMutation({
    mutationFn: (slug: string) => deleteMediaFolder(slug),
    onSuccess: (_r, slug) => {
      setDeptFolder('all')
      invalidate()
      toast('ok', 'Folder removed', slug)
    },
    onError: (err) => toast('bad', 'Could not delete folder', err instanceof Error ? err.message : 'Folder still has files or is built-in'),
  })

  const editMut = useMutation({
    mutationFn: async () => {
      if (!editTarget || editTarget.type.toLowerCase() !== 'library') {
        throw new Error('Only library assets can be edited here')
      }
      const saved = await updateMediaAsset(editTarget.id, {
        name: editName,
        altText: editAlt,
        folder: editFolder,
        ...(editFocal ? { focalX: editFocal.x, focalY: editFocal.y } : {}),
      })
      const fresh = await fetchMedia({ limit: 10, q: saved.path, type: 'library' })
      const verified = fresh.assets.find((asset) => asset.id === saved.id)
      if (!verified || verified.name !== saved.name || verified.altText !== (saved.altText ?? '')) {
        throw new Error('Media changes did not persist on server')
      }
      return saved
    },
    onSuccess: () => {
      setEditTarget(null)
      invalidate()
      toast('ok', 'Media updated and verified', 'Name, alt text and folder match server data.')
    },
    onError: (err) => toast('bad', 'Update failed', err instanceof Error ? err.message : 'Could not update media'),
  })

  const restoreMut = useMutation({
    mutationFn: (id: string) => restoreMediaAsset(id),
    onSuccess: () => {
      invalidate()
      toast('ok', 'Restored', 'Asset is back in the live library.')
    },
    onError: (err) => toast('bad', 'Restore failed', err instanceof Error ? err.message : 'Could not restore'),
  })

  // Only the Trash pane reads these totals, and the endpoint walks the whole
  // upload volume — the storage panel asks for it separately when it is open.
  const storage = useMediaStorage(libraryPane === 'trash')
  const trashSummary = storage.data?.split

  /** Permanent delete for the rows the admin ticked in Trash. */
  const purgeMut = useMutation({
    mutationFn: (ids: string[]) => purgeMediaAssets(ids),
    onSuccess: (res) => {
      setSelectedIds(new Set())
      invalidate()
      const failed = res.results.filter((row) => !row.ok)
      if (failed.length > 0) {
        toast('warn', `${res.deleted} deleted · ${failed.length} kept`, 'Files still linked somewhere cannot be deleted.')
        return
      }
      toast('ok', `${res.deleted} file${res.deleted === 1 ? '' : 's'} deleted forever`, 'Disk copies are gone too.')
    },
    onError: (err) => toast('bad', 'Delete failed', err instanceof Error ? err.message : 'Could not delete permanently'),
  })

  const restoreManyMut = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await restoreMediaAsset(id)
      return ids.length
    },
    onSuccess: (count) => {
      setSelectedIds(new Set())
      invalidate()
      toast('ok', `${count} restored`, 'Back in the live library.')
    },
    onError: (err) => toast('bad', 'Restore failed', err instanceof Error ? err.message : 'Could not restore'),
  })

  const emptyTrashMut = useMutation({
    mutationFn: () => emptyMediaTrash(),
    onSuccess: (res) => {
      invalidate()
      toast('ok', 'Trash emptied', `${res.deleted} asset${res.deleted === 1 ? '' : 's'} permanently removed.`)
    },
    onError: (err) => toast('bad', 'Empty trash failed', err instanceof Error ? err.message : 'Could not empty trash'),
  })

  const bulkDeleteMut = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteMediaAssets(ids),
    onSuccess: (res) => {
      const failed = res.results.filter((row) => !row.ok)
      setSelectedIds(new Set())
      invalidate()
      if (failed.length > 0) {
        toast('warn', 'Bulk delete partial', `${failed.length} still linked or failed.`)
        return
      }
      toast('ok', 'Moved to trash', `${res.results.length} library file${res.results.length === 1 ? '' : 's'}.`)
    },
    onError: (err) => toast('bad', 'Bulk delete failed', err instanceof Error ? err.message : 'Could not delete'),
  })

  const renameFolderMut = useMutation({
    mutationFn: async () => {
      if (!selectedLibraryFolder || selectedLibraryFolder.builtIn) throw new Error('Built-in folders cannot be renamed')
      return renameMediaFolder(selectedLibraryFolder.name, renameFolderLabel)
    },
    onSuccess: (folder) => {
      setRenameFolderOpen(false)
      setDeptFolder(folder.name)
      invalidate()
      toast('ok', 'Folder renamed', folder.name)
    },
    onError: (err) => toast('bad', 'Rename failed', err instanceof Error ? err.message : 'Could not rename folder'),
  })

  /**
   * Library shortcuts. They are deliberately inert while a field has focus —
   * typing "/" into the search box must search, not re-focus the box — and the
   * destructive one (Delete) only ever moves the selection to trash, which is
   * reversible.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      const target = event.target as HTMLElement | null
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable === true

      if (event.key === '/' && !typing) {
        event.preventDefault()
        searchRef.current?.focus()
        return
      }
      if (event.key === 'Escape' && !typing && selectedIds.size > 0) {
        setSelectedIds(new Set())
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a' && !typing) {
        const ids = rows.filter((row) => row.type.toLowerCase() === 'library').map((row) => row.id)
        if (ids.length === 0) return
        event.preventDefault()
        setSelectedIds(new Set(ids))
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && !typing && selectedIds.size > 0) {
        event.preventDefault()
        if (libraryPane === 'live') bulkDeleteMut.mutate([...selectedIds])
        else if (libraryPane === 'trash') purgeMut.mutate([...selectedIds])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bulkDeleteMut, libraryPane, purgeMut, rows, selectedIds])

  /** Arrow keys walk the grid; the column count comes from the rendered track. */
  const moveFocus = (delta: number) => {
    const next = Math.min(rows.length - 1, Math.max(0, focusIndex + delta))
    setFocusIndex(next)
    cardRefs.current[next]?.focus()
  }

  const gridColumns = () => {
    const grid = gridRef.current
    if (!grid) return 1
    return Math.max(1, window.getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length)
  }

  const skeleton: DcBlock[] = [
    { t: 'tabs', group: 'nav', items: [] } as DcBlock,
    { t: 'kpis' } as DcBlock,
    { t: 'media', title: '', slots: [] } as DcBlock,
  ]

  return (
    <div className="dc-mlib">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml,application/pdf,video/mp4,video/webm"
        hidden
        multiple
        onChange={(e) => {
          const picked = [...(e.target.files ?? [])]
          e.target.value = ''
          void selectUploadFiles(picked)
        }}
      />

      <DcPageHead
        crumbGroup="Content"
        title={libraryPane === 'trash' ? 'Media Library · Trash' : libraryPane === 'duplicates' ? 'Media Library · Duplicates' : 'Media Library'}
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          media.isFetching
            ? 'syncing…'
            : `${stats?.total ?? assets.length} asset${(stats?.total ?? assets.length) === 1 ? '' : 's'}`
        }
        syncing={media.isFetching}
        onSync={() => void media.refetch()}
        actions={[
          {
            label: 'New folder',
            icon: 'icon-folder-plus',
            onClick: () => {
              setNewFolderLabel('')
              setNestUnder(false)
              setNewFolderOpen(true)
            },
          },
          {
            label: 'Upload',
            icon: 'icon-upload',
            variant: 'primary' as const,
            onClick: () => fileRef.current?.click(),
          },
        ]}
      />

      <DcContentNav active="media" />

      <DcStoragePanel
        onOpenTrash={() => {
          setLibraryPane('trash')
          setSelectedIds(new Set())
        }}
      />

      <div className="dc-mlib__bar">
        <div className="dc-mlib__seg" role="tablist" aria-label="Library views">
          {(
            [
              ['live', 'Library'],
              ['trash', 'Trash'],
              ['duplicates', 'Dupes'],
              ['orphans', 'Orphans'],
            ] as const
          ).map(([id, title]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={libraryPane === id}
              className={libraryPane === id ? 'is-on' : ''}
              onClick={() => {
                setLibraryPane(id)
                setSelectedIds(new Set())
              }}
            >
              {title}
            </button>
          ))}
        </div>
        <div className="dc-mlib__search">
          <DcIcon name="icon-search" size={14} color="var(--ink-3)" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search  ( / )"
            aria-label="Search media"
          />
        </div>
        <select
          className="dc-mlib__select"
          aria-label="Type"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
        >
          {FILTERS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select
          className="dc-mlib__select"
          aria-label="Sort media"
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as typeof sortKey)}
        >
          <option value="updated">Newest</option>
          <option value="name">Name</option>
          <option value="size">Size</option>
        </select>
        <button type="button" className="dc-mlib__tool" onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')}>
          {viewMode === 'grid' ? 'Table' : 'Grid'}
        </button>
        {selectedIds.size > 0 && libraryPane === 'live' ? (
          <button
            type="button"
            className="dc-mlib__tool is-danger"
            disabled={bulkDeleteMut.isPending}
            onClick={() => bulkDeleteMut.mutate([...selectedIds])}
          >
            Trash {selectedIds.size}
          </button>
        ) : null}
        {libraryPane === 'trash' && selectedIds.size > 0 ? (
          <>
            <button
              type="button"
              className="dc-mlib__tool"
              disabled={restoreManyMut.isPending}
              onClick={() => restoreManyMut.mutate([...selectedIds])}
            >
              Restore {selectedIds.size}
            </button>
            <button
              type="button"
              className="dc-mlib__tool is-danger"
              disabled={purgeMut.isPending}
              onClick={() => purgeMut.mutate([...selectedIds])}
            >
              Delete {selectedIds.size} forever
            </button>
          </>
        ) : null}
        {libraryPane === 'trash' ? (
          <>
            <button
              type="button"
              className="dc-mlib__tool"
              onClick={() => {
                const ids = rows.filter((row) => row.type.toLowerCase() === 'library').map((row) => row.id)
                setSelectedIds((prev) => (prev.size === ids.length ? new Set() : new Set(ids)))
              }}
            >
              {selectedIds.size > 0 ? 'Clear selection' : 'Select all'}
            </button>
            <button
              type="button"
              className="dc-mlib__tool is-danger"
              disabled={emptyTrashMut.isPending || (trashSummary?.trashAssets ?? rows.length) === 0}
              onClick={() => emptyTrashMut.mutate()}
            >
              Empty trash
              {trashSummary
                ? ` (${trashSummary.trashAssets} file${trashSummary.trashAssets === 1 ? '' : 's'} · ${formatBytes(trashSummary.trashBytes)})`
                : ''}
            </button>
          </>
        ) : null}
        <span className="dc-mlib__quiet">{rows.length}</span>
      </div>

      {libraryPane === 'trash' ? (
        <p className="dc-mlib__note">
          Trashed files keep their disk space until they are deleted forever — nothing here is removed on a timer.
        </p>
      ) : null}

      <div className="dc-mlib__layout">
        <DcFolderRail
          tree={folderTree}
          active={mediaFolder}
          totalCount={stats?.total ?? assets.length}
          suggestions={folderSuggestions}
          busy={folderQuery.isFetching || moveMut.isPending}
          onSelect={(slug) => {
            setDeptFolder(slug)
            setSelectedIds(new Set())
          }}
          onCreate={(parentSlug) => {
            setCreateParent(parentSlug ?? null)
            setNewFolderLabel('')
            setNestUnder(false)
            setNewFolderOpen(true)
          }}
          onCreateNamed={(label) => createFolderMut.mutate({ label, parentSlug: undefined })}
          onRename={(node) => {
            setDeptFolder(node.name)
            setRenameFolderLabel(node.label?.trim() || mediaFolderLabel(node.name))
            setRenameFolderOpen(true)
          }}
          onDelete={(node) => deleteFolderMut.mutate(node.name)}
          onDropAssets={(slug, ids) => moveMut.mutate({ ids, folder: slug })}
          draggedIds={() => dragIdsRef.current}
        />
        <div className="dc-mlib__main">
      {libraryPane === 'orphans' ? (
        <DcOrphanPane onChanged={invalidate} toast={toast} />
      ) : libraryPane === 'duplicates' ? (
        <DcDuplicateGroups
          assets={dupeQuery.data?.assets ?? []}
          loading={dupeQuery.isLoading}
          error={dupeQuery.error}
          onRetry={() => void dupeQuery.refetch()}
          onChanged={invalidate}
          toast={toast}
        />
      ) : media.isLoading && libraryPane === 'live' ? (
        <DcLoadingState blocks={skeleton} />
      ) : media.error ? (
        <DcErrorState
          error={`GET /admin/platform/media → ${media.error instanceof Error ? media.error.message : '500 Internal Server Error'}`}
          hint="Images already on the storefront are unaffected — only this index failed to load."
          onRetry={() => void media.refetch()}
        />
      ) : assets.length === 0 && !pendingFile && deptFolder === 'all' && filter === 'All' && !deferredQuery && libraryPane === 'live' ? (
        <DcEmptyState
          icon="icon-image"
          title="Media library is empty"
          body="Upload an image here, or attach one from a product / hero slide. Upload can save to the library or attach straight to a product."
          cta="Upload image"
          onCta={() => fileRef.current?.click()}
        />
      ) : (
        <>

          {rows.length === 0 ? (
            <div style={{ ...card, padding: '48px 20px', textAlign: 'center' }}>
              <span style={{ font: `400 12.5px/1.55 ${FONT}`, color: 'var(--ink-3)' }}>
                {selectedLibraryFolder && selectedLibraryFolder.count === 0
                  ? 'This folder is empty. Upload to add files, or delete the empty folder.'
                  : 'Nothing matches that filter.'}
              </span>
            </div>
          ) : (
            <div
              className="dc-mlib__stage"
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes('Files')) {
                  event.preventDefault()
                  setDropActive(true)
                }
              }}
              onDragLeave={() => setDropActive(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDropActive(false)
                void selectUploadFiles([...(event.dataTransfer.files ?? [])])
              }}
            >
              {dropActive ? <div className="dc-mlib__dropveil">Drop to upload</div> : null}
              {viewMode === 'table' ? (
                <div style={{ ...card, overflow: 'auto' }}>
                  <table className="dc-mlib__table">
                    <thead>
                      <tr>
                        <th>File</th>
                        <th>Type</th>
                        <th>Size</th>
                        <th>Folder</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((a) => {
                        const url = a.url ? resolveMediaUrl(a.url) : null
                        const canRemove =
                          a.type.toLowerCase() === 'library' ||
                          (a.type.toLowerCase() === 'product' && Boolean(a.productId)) ||
                          a.type.toLowerCase() === 'banner' ||
                          a.type.toLowerCase() === 'category'
                        return (
                        <tr key={`${a.type}-${a.id}`}>
                          <td>
                            <button
                              type="button"
                              className="dc-mlib__row-open"
                              onClick={() => setPreviewKey({ type: a.type, id: a.id })}
                            >
                              {url ? (
                                // eslint-disable-next-line @next/next/no-img-element -- runtime upload URL
                                <img className="dc-mlib__row-thumb" src={heroMediaPreviewSrc(url)} alt="" />
                              ) : null}
                              <span>{a.name}</span>
                            </button>
                          </td>
                          <td>{a.type}</td>
                          <td>{a.sizeBytes ? `${(a.sizeBytes / 1024).toFixed(0)} KB` : '—'}</td>
                          <td>{a.folder ?? '—'}</td>
                          <td>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                              <button
                                type="button"
                                className="dc-mlib__tool"
                                onClick={() => setPreviewKey({ type: a.type, id: a.id })}
                              >
                                Preview
                              </button>
                            {canRemove ? (
                              <button
                                type="button"
                                className="dc-mlib__del"
                                onClick={() => {
                                  setDeleteUsage([])
                                  setDeleteTarget(a)
                                }}
                              >
                                Delete
                              </button>
                            ) : null}
                            </div>
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
              <div
                className="dc-mlib__grid"
                ref={gridRef}
                role="listbox"
                aria-label="Media assets"
                aria-multiselectable="true"
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight') {
                    event.preventDefault()
                    moveFocus(1)
                  } else if (event.key === 'ArrowLeft') {
                    event.preventDefault()
                    moveFocus(-1)
                  } else if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    moveFocus(gridColumns())
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    moveFocus(-gridColumns())
                  } else if (event.key === ' ') {
                    const asset = rows[focusIndex]
                    const url = asset?.url ? resolveMediaUrl(asset.url) : null
                    if (!url) return
                    event.preventDefault()
                    window.open(url, '_blank', 'noopener')
                  } else if (event.key === 'Enter') {
                    const asset = rows[focusIndex]
                    if (!asset || asset.type.toLowerCase() !== 'library') return
                    event.preventDefault()
                    setSelectedIds((prev) => {
                      const next = new Set(prev)
                      if (next.has(asset.id)) next.delete(asset.id)
                      else next.add(asset.id)
                      return next
                    })
                  }
                }}
              >
                {rows.map((a, index) => {
                  const url = a.url ? resolveMediaUrl(a.url) : null
                  const noAlt = !a.altText?.trim()
                  const grade = resolutionGrade(a.width, a.height)
                  const gradeTone = toneStyle(grade.tone)
                  const selected = selectedIds.has(a.id)
                  return (
                    <article
                      key={`${a.type}-${a.id}`}
                      className={`dc-mlib__tile${selected ? ' is-on' : ''}`}
                      role="option"
                      aria-selected={selected}
                      draggable={a.type.toLowerCase() === 'library' && libraryPane === 'live'}
                      tabIndex={index === focusIndex ? 0 : -1}
                      ref={(node) => {
                        cardRefs.current[index] = node
                      }}
                      onFocus={() => setFocusIndex(index)}
                      onDragStart={(event) => {
                        suppressPreviewRef.current = true
                        event.dataTransfer.setData('text/splaro-media-id', a.id)
                        event.dataTransfer.effectAllowed = 'move'
                        // Dragging a selected card drags the selection with it.
                        dragIdsRef.current = selectedIds.has(a.id) ? [...selectedIds] : [a.id]
                      }}
                      onDragEnd={() => {
                        dragIdsRef.current = []
                        window.requestAnimationFrame(() => {
                          suppressPreviewRef.current = false
                        })
                      }}
                    >
                      <div
                        className="dc-mlib__tile-media"
                        onClick={(event) => {
                          if (suppressPreviewRef.current) return
                          if ((event.target as HTMLElement).closest('input, button, a, summary')) return
                          setPreviewKey({ type: a.type, id: a.id })
                        }}
                      >
                      {a.type.toLowerCase() === 'library' ? (
                          <input
                            className="dc-mlib__check"
                            type="checkbox"
                            checked={selected}
                            aria-label={`Select ${a.name}`}
                            onChange={() => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(a.id)) next.delete(a.id)
                                else next.add(a.id)
                                return next
                              })
                            }}
                          />
                      ) : null}
                        <span className="dc-mlib__type">{a.type}</span>
                      <MediaThumbnail
                        url={url}
                        alt={a.altText || ''}
                        mimeType={a.mimeType}
                        kind={a.kind}
                        focalX={a.focalX}
                        focalY={a.focalY}
                      />
                      <span className="dc-mlib__peek">
                        <DcIcon name="icon-eye" size={11} />
                        Preview
                      </span>
                      </div>
                      <div className="dc-mlib__tile-body">
                      <span className="dc-mlib__name" title={a.name}>
                        {a.name}
                      </span>

                      <div className="dc-mlib__meta">
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            height: 22,
                            padding: '0 7px',
                            borderRadius: 6,
                            border: `1px solid ${gradeTone.bd}`,
                            background: gradeTone.bg,
                            color: gradeTone.fg,
                            font: `600 10.5px/1 ${FONT}`,
                            textTransform: 'capitalize',
                          }}
                        >
                          {grade.label}
                        </span>
                        {noAlt ? (
                          <span style={{ font: `600 10.5px/1 ${FONT}`, color: 'var(--warn)' }}>
                            no alt
                          </span>
                        ) : null}
                        <span style={{ flex: 1 }} />
                      </div>
                      <div className="dc-mlib__actions">
                        {a.type.toLowerCase() === 'library' ||
                        (a.type.toLowerCase() === 'product' && a.productId) ||
                        a.type.toLowerCase() === 'banner' ||
                        a.type.toLowerCase() === 'category' ? (
                          <button
                            type="button"
                            className="dc-mlib__del"
                            onClick={() => {
                              setDeleteUsage([])
                              setDeleteTarget(a)
                            }}
                          >
                            {libraryPane === 'trash' ? 'Delete forever' : 'Delete'}
                          </button>
                        ) : null}
                        {/* "Delete forever" is the button above — it opens the
                            confirm, which a permanent delete deserves. */}
                        {libraryPane === 'trash' ? (
                          <button
                            type="button"
                            className="dc-mlib__tool"
                            onClick={() => restoreMut.mutate(a.id)}
                          >
                            Restore
                          </button>
                        ) : null}
                        <details
                          style={{ position: 'relative', marginLeft: 'auto' }}
                          onKeyDown={(event) => {
                            if (event.key !== 'Escape') return
                            event.currentTarget.open = false
                            event.currentTarget.querySelector<HTMLElement>('summary')?.focus()
                          }}
                        >
                          <summary
                            aria-label={`Actions for ${a.name}`}
                            title="Asset actions"
                            style={{ ...iconButton, listStyle: 'none', display: 'grid', placeItems: 'center' }}
                          >
                            <DcIcon name="icon-ellipsis" size={15} />
                          </summary>
                          <div
                            role="menu"
                            aria-label={`Actions for ${a.name}`}
                            style={{
                              position: 'absolute',
                              zIndex: 20,
                              right: 0,
                              top: 27,
                              width: 208,
                              padding: 5,
                              border: '1px solid var(--line-2)',
                              borderRadius: 9,
                              background: 'var(--surface)',
                              boxShadow: 'var(--shadow-lg)',
                            }}
                          >
                            {url ? (
                              <AssetAction
                                label="Preview"
                                icon="icon-eye"
                                onClick={() => setPreviewKey({ type: a.type, id: a.id })}
                              />
                            ) : null}
                            {url ? (
                              <AssetAction
                                label="Open original"
                                icon="icon-external-link"
                                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                              />
                            ) : null}
                            {url ? (
                              <AssetAction
                                label="Copy public link"
                                icon="icon-copy"
                                onClick={() => {
                                  void navigator.clipboard.writeText(url).then(
                                    () => toast('ok', 'Public link copied', url),
                                    () => toast('bad', 'Copy failed', 'Browser denied clipboard access.'),
                                  )
                                }}
                              />
                            ) : null}
                            {a.url ? (
                              <AssetAction
                                label="Use in Hero Slider"
                                icon="icon-layout"
                                onClick={() => router.push(`/dashboard/hero-slider?image=${encodeURIComponent(a.url)}`)}
                              />
                            ) : null}
                            {a.type.toLowerCase() === 'library' ? (
                              <AssetAction
                                label="Edit details"
                                icon="icon-edit-3"
                                onClick={() => {
                                  setEditTarget(a)
                                  setEditName(a.name)
                                  setEditAlt(a.altText ?? '')
                                  setEditFolder((a.folder as MediaFolder | undefined) ?? 'media')
                                  setEditFocal(
                                    a.focalX != null && a.focalY != null ? { x: a.focalX, y: a.focalY } : null,
                                  )
                                }}
                              />
                            ) : null}
                            {a.type.toLowerCase() === 'library' && libraryPane === 'live' ? (
                              <AssetAction
                                label="Replace file"
                                icon="icon-refresh-cw"
                                onClick={() => setCropTarget(a)}
                              />
                            ) : null}
                            {a.type.toLowerCase() === 'library' ? (
                              <AssetAction
                                label="Where used"
                                icon="icon-link"
                                onClick={() => {
                                  void fetchMediaUsage(a.id).then(
                                    (res) => setUsageInspect({ asset: a, usage: res.usage }),
                                    (err) =>
                                      toast('bad', 'Usage lookup failed', err instanceof Error ? err.message : 'Could not load usage'),
                                  )
                                }}
                              />
                            ) : null}
                            {libraryPane === 'trash' ? (
                              <AssetAction label="Restore" icon="icon-rotate-ccw" onClick={() => restoreMut.mutate(a.id)} />
                            ) : null}
                            {a.type.toLowerCase() === 'banner' ? (
                              <AssetAction
                                label="Edit slide"
                                icon="icon-layout"
                                onClick={() => {
                                  setBannerEdit(a)
                                  setBannerTitle(a.name)
                                  setBannerSubtitle('')
                                  setBannerLink('')
                                }}
                              />
                            ) : null}
                            {a.type.toLowerCase() === 'category' ? (
                              <AssetAction
                                label="Edit category"
                                icon="icon-tag"
                                onClick={() => {
                                  setCategoryEdit(a)
                                  setCategoryName(a.name)
                                }}
                              />
                            ) : null}
                            {assetOwnerHref(a) ? (
                              <AssetAction
                                label="Open owner module"
                                icon="icon-external-link"
                                onClick={() => router.push(assetOwnerHref(a)!)}
                              />
                            ) : null}
                          </div>
                        </details>
                      </div>

                      <span
                        style={{
                          font: `400 10.5px/1.35 ${MONO}`,
                          color: 'var(--ink-3)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={a.source}
                      >
                        {a.source}
                      </span>
                      </div>
                    </article>
                  )
                })}
              </div>
              )}
              {media.hasNextPage && libraryPane === 'live' ? (
                <button
                  type="button"
                  disabled={media.isFetchingNextPage}
                  onClick={() => void media.fetchNextPage()}
                  style={{
                    alignSelf: 'center',
                    height: 34,
                    padding: '0 16px',
                    borderRadius: 9,
                    border: '1px solid var(--line-2)',
                    background: 'var(--surface-2)',
                    color: 'var(--ink-2)',
                    cursor: media.isFetchingNextPage ? 'wait' : 'pointer',
                    font: `600 12px/1 ${FONT}`,
                  }}
                >
                  {media.isFetchingNextPage ? 'Loading…' : 'Load more media'}
                </button>
              ) : null}
            </div>
          )}
        </>
      )}
        </div>
      </div>

      <DcModal
        open={Boolean(pendingFile)}
        title="Upload image"
        subtitle={
          pendingFile
            ? `${pendingFile.name} · pick menu folder and a display name`
            : undefined
        }
        confirmLabel={attachProductId ? 'Attach to product' : 'Save to library'}
        busy={uploadMut.isPending}
        busyLabel={
          uploadPhase === 'indexing'
            ? 'Indexing…'
            : uploadPhase === 'optimizing'
              ? 'Optimizing…'
              : `Uploading${uploadProgress ? ` ${uploadProgress}%` : '…'}`
        }
        onClose={() => {
          if (uploadMut.isPending) {
            uploadAbortRef.current?.abort()
            return
          }
          resetUploadModal()
        }}
        onConfirm={() => {
          if (!pendingFile) return
          uploadMut.mutate({
            file: pendingFile,
            productId: attachProductId || null,
            folder: uploadFolder,
            name: uploadName,
            altText: uploadAlt,
          })
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {uploadPreview ? (
            <div style={{ display: 'grid', gridTemplateColumns: '112px 1fr', gap: 12, alignItems: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img
                src={uploadPreview}
                alt="Selected upload preview"
                style={{ width: 112, height: 84, objectFit: 'cover', borderRadius: 9, border: '1px solid var(--line)' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                <span style={{ font: `600 12px/1.3 ${FONT}`, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pendingFile?.name}
                </span>
                <span style={{ font: `400 11px/1.4 ${MONO}`, color: 'var(--ink-3)' }}>
                  {pendingFile ? `${(pendingFile.size / 1024 / 1024).toFixed(2)} MB` : ''}
                  {uploadDimensions ? ` · ${uploadDimensions.width} × ${uploadDimensions.height}px` : ''}
                </span>
              </div>
            </div>
          ) : null}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)', letterSpacing: '.06em' }}>
              MENU
            </span>
            <FolderSelect
              value={uploadFolder}
              onChange={setUploadFolder}
              folders={libraryFolders}
              selectStyle={{
                height: 38,
                borderRadius: 9,
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
                color: 'var(--ink)',
                padding: '0 10px',
                font: `500 13px/1 ${FONT}`,
              }}
              inputStyle={modalInput}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)', letterSpacing: '.06em' }}>
              ALT TEXT
            </span>
            <input
              value={uploadAlt}
              onChange={(e) => setUploadAlt(e.target.value)}
              placeholder="Describe image for SEO and screen readers"
              style={modalInput}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)', letterSpacing: '.06em' }}>
              NAME
            </span>
            <input
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="e.g. Navy Loafer Front"
              style={{
                height: 38,
                borderRadius: 9,
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
                color: 'var(--ink)',
                padding: '0 10px',
                font: `500 13px/1 ${FONT}`,
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)', letterSpacing: '.06em' }}>
              PRODUCT (OPTIONAL)
            </span>
            <select
              value={attachProductId}
              onChange={(e) => setAttachProductId(e.target.value)}
              style={{
                height: 38,
                borderRadius: 9,
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
                color: 'var(--ink)',
                padding: '0 10px',
                font: `500 13px/1 ${FONT}`,
              }}
            >
              <option value="">Library only — not on a product yet</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {RASTER_UPLOAD.has(pendingFile?.type ?? '') ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, font: `500 12px/1 ${FONT}`, color: 'var(--ink-2)' }}>
              <input type="checkbox" checked={watermarkUpload} onChange={(event) => setWatermarkUpload(event.target.checked)} />
              Overlay SPLARO mark on this raster upload
            </label>
          ) : null}
        </div>
      </DcModal>

      <DcModal
        open={queueFiles.length > 0}
        title={`Upload ${queueFiles.length} files`}
        subtitle={`Saving to ${mediaFolderLabel(uploadFolder)} — each file keeps its own name and alt text.`}
        confirmLabel="Done"
        busy={queueBusy}
        busyLabel="Uploading…"
        onClose={() => {
          if (queueBusy) return
          setQueueFiles([])
        }}
        onConfirm={() => {
          if (queueBusy) return
          setQueueFiles([])
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={capsLabel}>Folder for this batch</span>
            <FolderSelect
              value={uploadFolder}
              onChange={setUploadFolder}
              folders={libraryFolders}
              selectStyle={modalInput}
              inputStyle={modalInput}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, font: `500 12px/1 ${FONT}`, color: 'var(--ink-2)' }}>
            <input
              type="checkbox"
              checked={watermarkUpload}
              disabled={queueBusy}
              onChange={(event) => setWatermarkUpload(event.target.checked)}
            />
            Watermark every raster image in this batch
          </label>
          {queueFiles.length > 0 ? (
            <DcUploadQueue
              files={queueFiles}
              folder={uploadFolder}
              watermark={watermarkUpload}
              onProgressChange={setQueueBusy}
              onFinished={({ saved, failed, duplicates }) => {
                invalidate()
                if (saved > 0) setDeptFolder(uploadFolder)
                if (failed > 0) {
                  toast('warn', `${saved} saved · ${failed} failed`, 'Retry the failed rows, or remove them and try a smaller file.')
                } else if (duplicates > 0) {
                  toast('ok', `${saved} saved`, `${duplicates} already existed in the library — check the Dupes pane.`)
                } else {
                  toast('ok', `${saved} file${saved === 1 ? '' : 's'} saved`, mediaFolderLabel(uploadFolder))
                }
              }}
            />
          ) : null}
        </div>
      </DcModal>

      <DcModal
        open={newFolderOpen}
        title="New folder"
        subtitle="Folders are labels in this library. Files stay on the upload disk, not Google Sheets."
        confirmLabel="Create"
        busy={createFolderMut.isPending}
        busyLabel="Creating…"
        disabled={!newFolderLabel.trim()}
        disabledLabel="Name required"
        onClose={() => {
          if (createFolderMut.isPending) return
          setNewFolderOpen(false)
        }}
        onConfirm={() => {
          if (!newFolderLabel.trim()) return
          createFolderMut.mutate({ label: newFolderLabel, parentSlug: pendingParentSlug })
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={capsLabel}>Folder name</span>
          <input
            autoFocus
            value={newFolderLabel}
            onChange={(event) => setNewFolderLabel(event.target.value)}
            placeholder="e.g. Campaign 2026"
            maxLength={40}
            style={modalInput}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && newFolderLabel.trim()) {
                createFolderMut.mutate({ label: newFolderLabel, parentSlug: pendingParentSlug })
              }
            }}
          />
        </label>
        {createParent ? (
          <p style={{ marginTop: 10, font: `500 12px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
            Nested inside {mediaFolderLabel(createParent)}.
          </p>
        ) : selectedLibraryFolder && !selectedLibraryFolder.builtIn && !selectedLibraryFolder.name.includes('/') ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, font: `500 12px/1 ${FONT}`, color: 'var(--ink-2)' }}>
            <input type="checkbox" checked={nestUnder} onChange={(event) => setNestUnder(event.target.checked)} />
            Nest inside {folderChipLabel(selectedLibraryFolder)}
          </label>
        ) : null}
      </DcModal>

      <DcModal
        open={Boolean(deleteTarget)}
        title={
          deleteTarget?.type.toLowerCase() === 'product' ? 'Delete this product image?' : 'Delete this asset?'
        }
        subtitle={
          deleteTarget?.type.toLowerCase() === 'product'
            ? `${deleteTarget.name} stays in the catalogue. Only this gallery image is removed. Last image leaves the product page without a photo.`
            : deleteTarget
              ? `${deleteTarget.name} · ${deleteTarget.type}`
              : undefined
        }
        confirmLabel="Delete"
        danger
        busy={deleteMut.isPending}
        busyLabel="Deleting…"
        disabled={deleteUsage.length > 0}
        disabledLabel="Unlink first"
        onClose={() => {
          if (deleteMut.isPending) return
          setDeleteTarget(null)
          setDeleteUsage([])
        }}
        onConfirm={() => {
          if (!deleteTarget) return
          if (deleteUsage.length > 0) return
          deleteMut.mutate(deleteTarget)
        }}
      >
        {deleteUsage.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ font: `600 12px/1.4 ${FONT}`, color: 'var(--bad)' }}>
              Delete blocked — image is linked in {deleteUsage.length} place{deleteUsage.length === 1 ? '' : 's'}.
            </span>
            {deleteUsage.map((usage) => (
              <div key={`${usage.type}-${usage.id}`} style={{ padding: '9px 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface-2)' }}>
                <span style={{ font: `600 10px/1 ${FONT}`, color: 'var(--ink-3)', textTransform: 'uppercase' }}>{usage.type}</span>
                <span style={{ marginLeft: 8, font: `500 12px/1.3 ${FONT}`, color: 'var(--ink)' }}>{usage.label}</span>
              </div>
            ))}
          </div>
        ) : null}
      </DcModal>

      <DcModal
        open={Boolean(editTarget)}
        title="Edit media details"
        subtitle={editTarget?.url}
        confirmLabel="Save changes"
        busy={editMut.isPending}
        busyLabel="Saving…"
        onClose={() => {
          if (!editMut.isPending) setEditTarget(null)
        }}
        onConfirm={() => editMut.mutate()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={capsLabel}>Name</span>
            <input value={editName} onChange={(event) => setEditName(event.target.value)} style={modalInput} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={capsLabel}>Alt text</span>
            <input value={editAlt} onChange={(event) => setEditAlt(event.target.value)} style={modalInput} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={capsLabel}>Folder</span>
            <FolderSelect
              value={editFolder}
              onChange={setEditFolder}
              folders={libraryFolders}
              selectStyle={modalInput}
              inputStyle={modalInput}
            />
          </label>
          {editTarget?.url ? (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={capsLabel}>Focal point — click the preview</span>
              <button
                type="button"
                onClick={(event) => {
                  const box = event.currentTarget.getBoundingClientRect()
                  const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
                  const y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height))
                  setEditFocal({ x, y })
                }}
                style={{ position: 'relative', border: 0, padding: 0, cursor: 'crosshair', borderRadius: 9, overflow: 'hidden' }}
              >
                <MediaThumbnail
                  url={resolveMediaUrl(editTarget.url)}
                  alt=""
                  mimeType={editTarget.mimeType}
                  kind={editTarget.kind}
                  focalX={editFocal?.x}
                  focalY={editFocal?.y}
                />
                {editFocal ? (
                  <span
                    style={{
                      position: 'absolute',
                      left: `${editFocal.x * 100}%`,
                      top: `${editFocal.y * 100}%`,
                      width: 10,
                      height: 10,
                      margin: -5,
                      borderRadius: 999,
                      background: 'var(--violet-solid)',
                      pointerEvents: 'none',
                    }}
                  />
                ) : null}
              </button>
            </label>
          ) : null}
        </div>
      </DcModal>

      <DcModal
        open={renameFolderOpen}
        title="Rename folder"
        confirmLabel="Rename"
        busy={renameFolderMut.isPending}
        onClose={() => setRenameFolderOpen(false)}
        onConfirm={() => renameFolderMut.mutate()}
      >
        <input value={renameFolderLabel} onChange={(event) => setRenameFolderLabel(event.target.value)} style={modalInput} />
      </DcModal>

      <DcModal
        open={Boolean(bannerEdit)}
        title="Edit hero slide"
        confirmLabel="Save slide"
        onClose={() => setBannerEdit(null)}
        onConfirm={() => {
          if (!bannerEdit) return
          void updateBanner(bannerEdit.id, {
            title: bannerTitle,
            ...(bannerSubtitle.trim() ? { subtitle: bannerSubtitle } : {}),
            ...(bannerLink.trim() ? { linkUrl: bannerLink } : {}),
          }).then(
            () => {
              setBannerEdit(null)
              invalidate()
              toast('ok', 'Slide updated', bannerTitle)
            },
            (err) => toast('bad', 'Slide not saved', err instanceof Error ? err.message : 'Update failed'),
          )
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={bannerTitle} onChange={(event) => setBannerTitle(event.target.value)} placeholder="Title" style={modalInput} />
          <input value={bannerSubtitle} onChange={(event) => setBannerSubtitle(event.target.value)} placeholder="Subtitle" style={modalInput} />
          <input value={bannerLink} onChange={(event) => setBannerLink(event.target.value)} placeholder="/shop" style={modalInput} />
        </div>
      </DcModal>

      <DcModal
        open={Boolean(categoryEdit)}
        title="Edit category"
        confirmLabel="Save category"
        onClose={() => setCategoryEdit(null)}
        onConfirm={() => {
          if (!categoryEdit) return
          void updateCategory(categoryEdit.id, { name: categoryName }).then(
            () => {
              setCategoryEdit(null)
              invalidate()
              toast('ok', 'Category updated', categoryName)
            },
            (err) => toast('bad', 'Category not saved', err instanceof Error ? err.message : 'Update failed'),
          )
        }}
      >
        <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} style={modalInput} />
      </DcModal>

      <DcModal
        open={Boolean(cropTarget)}
        title="Replace file"
        subtitle="Upload a new file for this library asset. This replaces bytes in place."
        confirmLabel="Choose file"
        onClose={() => setCropTarget(null)}
        onConfirm={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml,application/pdf,video/mp4,video/webm'
          input.onchange = () => {
            const file = input.files?.[0]
            const target = cropTarget
            if (!file || !target) return
            void (async () => {
              try {
                const uploaded = await uploadAdminImage(file, 'media', {
                  optimize: RASTER_UPLOAD.has(file.type) && file.type !== 'image/gif',
                })
                await replaceMediaAsset(target.id, {
                  path: uploaded.url,
                  ...(uploaded.mimeType ? { mimeType: uploaded.mimeType } : {}),
                  ...(uploaded.sizeBytes !== undefined ? { sizeBytes: uploaded.sizeBytes } : {}),
                  ...(uploaded.width !== undefined ? { width: uploaded.width } : {}),
                  ...(uploaded.height !== undefined ? { height: uploaded.height } : {}),
                  ...(uploaded.contentHash ? { contentHash: uploaded.contentHash } : {}),
                  ...(uploaded.kind ? { kind: uploaded.kind } : {}),
                })
                setCropTarget(null)
                invalidate()
                toast('ok', 'File replaced', target.name)
              } catch (err) {
                toast('bad', 'Replace failed', err instanceof Error ? err.message : 'Could not replace file')
              }
            })()
          }
          input.click()
        }}
      >
        <span style={{ font: `400 12px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
          {cropTarget?.name} — current file stays until the new upload is indexed.
        </span>
      </DcModal>

      <DcModal
        open={Boolean(usageInspect)}
        title="Where used"
        confirmLabel="Close"
        onClose={() => setUsageInspect(null)}
        onConfirm={() => setUsageInspect(null)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(usageInspect?.usage ?? []).length === 0 ? (
            <span style={{ font: `400 12px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>Not linked anywhere in the catalogue.</span>
          ) : (
            usageInspect?.usage.map((usage) => (
              <div key={`${usage.type}-${usage.id}`} style={{ padding: '9px 10px', border: '1px solid var(--line)', borderRadius: 8 }}>
                <span style={{ font: `600 10px/1 ${FONT}`, color: 'var(--ink-3)', textTransform: 'uppercase' }}>{usage.type}</span>
                <span style={{ marginLeft: 8, font: `500 12px/1.3 ${FONT}` }}>{usage.label}</span>
              </div>
            ))
          )}
        </div>
      </DcModal>

      <DcMediaLightbox
        assets={rows}
        activeKey={previewKey}
        onActiveKeyChange={setPreviewKey}
        onClose={() => setPreviewKey(null)}
      />
    </div>
  )
}

function MediaThumbnail({
  url,
  alt,
  mimeType,
  kind,
  focalX,
  focalY,
}: {
  url: string | null
  alt: string
  mimeType?: string | null | undefined
  kind?: string | null | undefined
  focalX?: number | null | undefined
  focalY?: number | null | undefined
}) {
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => setFailed(false), [url])

  const mime = (mimeType ?? '').toLowerCase()
  const isVideo = kind === 'video' || mime.startsWith('video/')
  const isPdf = kind === 'pdf' || mime === 'application/pdf'

  if (url && isPdf) {
    return (
      <div
        className="dc-mlib__frame"
        style={{
          display: 'grid',
          placeItems: 'center',
          background: 'var(--surface-2)',
          color: 'var(--ink-2)',
          font: `600 13px/1 ${FONT}`,
        }}
      >
        PDF
      </div>
    )
  }

  if (url && isVideo) {
    return (
      <video
        src={url}
        muted
        playsInline
        preload="metadata"
        className="dc-mlib__frame"
      />
    )
  }

  if (!url || failed) {
    return (
      <div
        className="dc-mlib__frame"
        style={{
          display: 'grid',
          placeItems: 'center',
          alignContent: 'center',
          gap: 7,
          background: 'var(--surface-2)',
          color: 'var(--ink-3)',
        }}
      >
        <DcIcon name="icon-image-off" size={16} />
        <span style={{ font: `600 10.5px/1 ${FONT}` }}>{failed ? 'Image unavailable' : 'No image URL'}</span>
        {failed ? (
          <button
            type="button"
            aria-label="Retry loading image"
            title="Retry loading image"
            onClick={() => {
              setFailed(false)
              setAttempt((value) => value + 1)
            }}
            style={{ ...iconButton, font: `600 10.5px/1 ${FONT}` }}
          >
            Retry
          </button>
        ) : null}
      </div>
    )
  }

  const preview = heroMediaPreviewSrc(url)
  const separator = preview.includes('?') ? '&' : '?'
  // eslint-disable-next-line @next/next/no-img-element -- public upload URL is runtime-configured
  return (
    <div
      className="dc-mlib__frame"
      role="img"
      aria-label={alt || 'Media image'}
      style={{ overflow: 'hidden', background: 'var(--surface-2)' }}
    >
      <img
        key={attempt}
        src={`${preview}${attempt ? `${separator}retry=${attempt}` : ''}`}
        alt=""
        onError={() => setFailed(true)}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition:
            focalX != null && focalY != null ? `${Math.round(focalX * 100)}% ${Math.round(focalY * 100)}%` : 'center',
        }}
      />
    </div>
  )
}

function AssetAction({
  label,
  icon,
  onClick,
  danger,
}: {
  label: string
  icon: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-label={label}
      title={label}
      onClick={(event) => {
        const details = event.currentTarget.closest('details')
        if (details) details.open = false
        onClick()
      }}
      style={{
        width: '100%',
        minHeight: 32,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 9px',
        border: 0,
        borderRadius: 7,
        background: 'transparent',
        color: danger ? 'var(--bad)' : 'var(--ink-2)',
        cursor: 'pointer',
        font: `600 11.5px/1.2 ${FONT}`,
        textAlign: 'left',
      }}
    >
      <DcIcon name={icon} size={13} />
      <span>{label}</span>
    </button>
  )
}
