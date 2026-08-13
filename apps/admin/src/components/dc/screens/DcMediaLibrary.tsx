'use client'

/* eslint-disable @next/next/no-img-element -- blob previews and runtime public upload URLs */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { DcContentNav } from '@/components/dc/DcContentNav'
import { DcIcon } from '@/components/dc/DcIcon'
import { DcModal } from '@/components/dc/DcModal'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import { useMedia, useProducts } from '@/lib/api/hooks'
import {
  createMediaAsset,
  deleteMediaAsset,
  deleteOrphanUpload,
  updateMediaAsset,
  type MediaFolder,
  type MediaUsage,
} from '@/lib/api/media'
import { ApiError } from '@/lib/api/client'
import { fetchMedia } from '@/lib/api/platform'
import { addProductImage, fetchProduct } from '@/lib/api/products'
import { readImageDimensions, uploadAdminImage } from '@/lib/api/upload'
import { resolveMediaUrl } from '@/lib/media-url'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { MEDIA_DEPT_FOLDERS, type MediaDeptFolder } from '@/lib/admin/size-presets'

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

/** Asset source → chip tone. Violet stays out of chips (rule 1). */
const SOURCE_TONE: Record<string, DcTone> = {
  library: 'ok',
  product: 'info',
  banner: 'ok',
  category: 'warn',
}

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
}

const ALLOWED_UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_LIBRARY_BYTES = 8 * 1024 * 1024
const MAX_PRODUCT_BYTES = 12 * 1024 * 1024

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function cleanupOrphanWithRetry(path: string): Promise<void> {
  let lastError: unknown
  for (const waitMs of [0, 500, 1_500, 3_000]) {
    if (waitMs) await delay(waitMs)
    try {
      await deleteOrphanUpload(path)
      return
    } catch (error) {
      lastError = error
      if (!(error instanceof ApiError) || error.status !== 409) throw error
    }
  }
  throw lastError
}

const LIBRARY_FOLDERS: Array<{ value: MediaFolder; label: string }> = [
  { value: 'media', label: 'General / Hero' },
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
  { value: 'kids', label: 'Kids' },
  { value: 'footwear', label: 'Footwear' },
  { value: 'accessories', label: 'Accessories' },
]

const MEDIA_LIBRARY_FILTER_FOLDERS = [
  { key: 'all', label: 'All media', value: 'all' },
  { key: 'media', label: 'General / Hero', value: 'media' },
  ...MEDIA_DEPT_FOLDERS.filter((folder) => folder.key !== 'all').map((folder) => ({
    key: folder.key,
    label: folder.label,
    value: folder.folder,
  })),
] as const

function productFolder(folder: MediaFolder): MediaDeptFolder {
  return folder === 'media' ? 'products' : (`products-${folder}` as MediaDeptFolder)
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

  const [filter, setFilter] = useState<Filter>('All')
  const [deptFolder, setDeptFolder] = useState<MediaDeptFolder | 'media' | 'all'>('all')
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
  const deferredQuery = useDebouncedValue(query)
  const mediaType = filter.toLowerCase() as 'all' | 'library' | 'product' | 'banner' | 'category'
  const mediaFolder = deptFolder === 'all'
    ? 'all'
    : (deptFolder.replace(/^products-?/, '') || 'media') as 'media' | 'men' | 'women' | 'kids' | 'footwear' | 'accessories'
  const media = useMedia({ limit: 60, q: deferredQuery, type: mediaType, folder: mediaFolder })

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
  const assets = useMemo(
    () => (media.data?.pages.flatMap((page) => page.assets) ?? []) as MediaAsset[],
    [media.data],
  )
  const productOptions = products.data?.products ?? []

  const rows = assets

  const missingAlt = stats?.missingAlt ?? assets.filter((asset) => !asset.altText?.trim()).length
  const pageStatus = dcPageStatus([media], api.pulse)

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['platform-media'] })
    void media.refetch()
  }

  const selectUploadFile = async (file: File) => {
    if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
      toast('bad', 'Unsupported image', 'Choose a JPG, PNG or WebP file.')
      return
    }
    if (file.size > MAX_PRODUCT_BYTES) {
      toast('bad', 'Image is too large', 'Maximum product image size is 12MB; library-only limit is 8MB.')
      return
    }
    try {
      const dimensions = await readImageDimensions(file)
      if (dimensions.width < 1 || dimensions.height < 1) throw new Error('Invalid image dimensions')
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
      toast('bad', 'Unreadable image', 'Browser could not decode this file. Choose another JPG, PNG or WebP.')
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
      if (!productId && file.size > MAX_LIBRARY_BYTES) {
        throw new Error('Library uploads must be 8MB or smaller. Attach to a product or choose a smaller file.')
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
      setDeptFolder(res.mode === 'product' ? productFolder(res.folder) : 'all')
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
      throw new Error(`${type || 'unknown'} assets must be changed from their owner module`)
    },
    onSuccess: (result) => {
      setDeleteTarget(null)
      invalidate()
      if (result && 'fileDeleted' in result && result.fileDeleted === false) {
        toast('warn', 'Media removed from library', result.warning ?? 'Physical file cleanup needs attention.')
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

  const editMut = useMutation({
    mutationFn: async () => {
      if (!editTarget || editTarget.type.toLowerCase() !== 'library') {
        throw new Error('Only library assets can be edited here')
      }
      const saved = await updateMediaAsset(editTarget.id, {
        name: editName,
        altText: editAlt,
        folder: editFolder,
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

  const skeleton: DcBlock[] = [
    { t: 'tabs', group: 'nav', items: [] } as DcBlock,
    { t: 'kpis' } as DcBlock,
    { t: 'media', title: '', slots: [] } as DcBlock,
  ]

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null
          e.target.value = ''
          if (!file) return
          void selectUploadFile(file)
        }}
      />

      <DcPageHead
        crumbGroup="Content"
        title="Media Library"
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
            label: 'Upload',
            icon: 'icon-upload',
            variant: 'primary',
            onClick: () => fileRef.current?.click(),
          },
        ]}
      />

      <DcContentNav active="media" />

      {media.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : media.error ? (
        <DcErrorState
          error={`GET /admin/platform/media → ${media.error instanceof Error ? media.error.message : '500 Internal Server Error'}`}
          hint="Images already on the storefront are unaffected — only this index failed to load."
          onRetry={() => void media.refetch()}
        />
      ) : assets.length === 0 && !pendingFile ? (
        <DcEmptyState
          icon="icon-image"
          title="Media library is empty"
          body="Upload an image here, or attach one from a product / hero slide. Upload can save to the library or attach straight to a product."
          cta="Upload image"
          onCta={() => fileRef.current?.click()}
        />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(206px, 1fr))',
              gap: 12,
            }}
          >
            <Kpi
              label="Total assets"
              value={String(stats?.total ?? assets.length)}
              sub="indexed across the store"
            />
            <Kpi
              label="Product images"
              value={String(stats?.products ?? 0)}
              sub="attached to a product"
            />
            <Kpi label="Library files" value={String(stats?.library ?? 0)} sub="reusable public media" />
            <Kpi
              label="Missing alt text"
              value={String(missingAlt)}
              sub="hurts SEO and screen readers"
              color={missingAlt > 0 ? 'var(--warn)' : 'var(--ink)'}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              padding: '11px 14px',
              ...card,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 34,
                padding: '0 11px',
                borderRadius: 9,
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
                minWidth: 230,
              }}
            >
              <DcIcon name="icon-search" size={14} color="var(--ink-3)" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filename, alt text or path…"
                aria-label="Search media"
                style={{
                  flex: 1,
                  border: 0,
                  background: 'transparent',
                  outline: 'none',
                  color: 'var(--ink)',
                  font: `400 13px/1 ${FONT}`,
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {FILTERS.map((f) => {
                const on = f === filter
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    style={{
                      height: 30,
                      padding: '0 11px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      font: `600 12px/1 ${FONT}`,
                      border: `1px solid ${on ? 'var(--violet-solid)' : 'var(--line)'}`,
                      background: on ? 'var(--violet-solid)' : 'var(--surface-2)',
                      color: on ? 'var(--on-violet)' : 'var(--ink-2)',
                    }}
                  >
                    {f}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', width: '100%' }}>
              <span style={{ ...capsLabel, alignSelf: 'center' }}>Folder</span>
              {MEDIA_LIBRARY_FILTER_FOLDERS.map((f) => {
                const on = deptFolder === f.value
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setDeptFolder(f.value)}
                    style={{
                      height: 28,
                      padding: '0 10px',
                      borderRadius: 999,
                      cursor: 'pointer',
                      font: `600 11px/1 ${FONT}`,
                      border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`,
                      background: on ? 'var(--ink)' : 'transparent',
                      color: on ? 'var(--surface)' : 'var(--ink-2)',
                    }}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>

            <div style={{ flex: 1 }} />
            <span style={{ font: `500 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>
              {rows.length} loaded · {stats?.total ?? assets.length} total
            </span>
          </div>

          {rows.length === 0 ? (
            <div style={{ ...card, padding: '48px 20px', textAlign: 'center' }}>
              <span style={{ font: `400 12.5px/1.55 ${FONT}`, color: 'var(--ink-3)' }}>
                Nothing matches that filter.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                  gap: 12,
                }}
              >
              {rows.map((a) => {
                const tone = toneStyle(SOURCE_TONE[(a.type ?? '').toLowerCase()] ?? 'mute')
                const url = a.url ? resolveMediaUrl(a.url) : null
                const noAlt = !a.altText?.trim()
                return (
                  <div
                    key={`${a.type}-${a.id}`}
                    style={{
                      ...card,
                      padding: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 9,
                      minWidth: 0,
                    }}
                  >
                    <MediaThumbnail url={url} alt={a.altText || ''} />

                    <span
                      style={{
                        font: `500 12px/1.35 ${FONT}`,
                        color: 'var(--ink)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={a.name}
                    >
                      {a.name}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          height: 22,
                          padding: '0 7px',
                          borderRadius: 6,
                          border: `1px solid ${tone.bd}`,
                          background: tone.bg,
                          color: tone.fg,
                          font: `600 10.5px/1 ${FONT}`,
                          textTransform: 'capitalize',
                        }}
                      >
                        {a.type}
                      </span>
                      {noAlt ? (
                        <span style={{ font: `600 10.5px/1 ${FONT}`, color: 'var(--warn)' }}>
                          no alt
                        </span>
                      ) : null}
                      <span style={{ flex: 1 }} />
                      <details
                        style={{ position: 'relative' }}
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
                            width: 174,
                            padding: 5,
                            border: '1px solid var(--line-2)',
                            borderRadius: 9,
                            background: 'var(--surface)',
                            boxShadow: 'var(--shadow-lg)',
                          }}
                        >
                          {url ? (
                            <AssetAction label="Preview" icon="icon-eye" onClick={() => window.open(url, '_blank')} />
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
                          {a.type.toLowerCase() === 'library' ? (
                            <AssetAction
                              label="Delete"
                              icon="icon-trash-2"
                              danger
                              onClick={() => {
                                setDeleteUsage([])
                                setDeleteTarget(a)
                              }}
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
                )
              })}
              </div>
              {media.hasNextPage ? (
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

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              marginTop: 4,
              padding: '11px 14px',
              borderRadius: 11,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
            }}
          >
            <DcIcon name="icon-info" size={14} color="var(--ink-3)" />
            <span
              style={{
                flex: 1,
                font: `400 12px/1.5 ${FONT}`,
                color: 'var(--ink-3)',
                textWrap: 'pretty',
              }}
            >
              Library uploads create reusable public files. Product attachment uses responsive
              product processing. Linked library files cannot be deleted until every usage is
              removed.
            </span>
          </div>
        </>
      )}

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
            <select
              value={uploadFolder}
              onChange={(e) => setUploadFolder(e.target.value as MediaFolder)}
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
              {LIBRARY_FOLDERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
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
        </div>
      </DcModal>

      <DcModal
        open={Boolean(deleteTarget)}
        title="Delete this asset?"
        subtitle={
          deleteTarget
            ? `${deleteTarget.name} · ${deleteTarget.type} — this cannot be undone from trash`
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
            <select value={editFolder} onChange={(event) => setEditFolder(event.target.value as MediaFolder)} style={modalInput}>
              {LIBRARY_FOLDERS.map((folder) => (
                <option key={folder.value} value={folder.value}>{folder.label}</option>
              ))}
            </select>
          </label>
        </div>
      </DcModal>
    </>
  )
}

function MediaThumbnail({ url, alt }: { url: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => setFailed(false), [url])

  if (!url || failed) {
    return (
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          alignContent: 'center',
          gap: 7,
          height: 132,
          borderRadius: 9,
          border: '1px dashed var(--line-2)',
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

  const separator = url.includes('?') ? '&' : '?'
  // eslint-disable-next-line @next/next/no-img-element -- public upload URL is runtime-configured
  return (
    <div
      role="img"
      aria-label={alt || 'Media image'}
      style={{ width: '100%', height: 132, borderRadius: 9, border: '1px solid var(--line)', overflow: 'hidden', background: 'var(--surface-2)' }}
    >
      <img
        key={attempt}
        src={`${url}${attempt ? `${separator}retry=${attempt}` : ''}`}
        alt=""
        onError={() => setFailed(true)}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
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

function Kpi({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub: string
  color?: string
}) {
  return (
    <div
      style={{ ...card, padding: '14px 15px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <span style={capsLabel}>{label}</span>
      <span
        style={{ font: `700 25px/1 ${FONT}`, letterSpacing: '-.025em', color: color ?? 'var(--ink)' }}
      >
        {value}
      </span>
      <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
    </div>
  )
}
