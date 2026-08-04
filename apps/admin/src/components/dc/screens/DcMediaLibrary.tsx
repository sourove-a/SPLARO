'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'

import { DcContentNav } from '@/components/dc/DcContentNav'
import { DcIcon } from '@/components/dc/DcIcon'
import { DcModal } from '@/components/dc/DcModal'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import { deleteBanner, createBanner } from '@/lib/api/banners'
import { updateCategory } from '@/lib/api/categories'
import { useMedia, useProducts } from '@/lib/api/hooks'
import { addProductImage, deleteProductImage } from '@/lib/api/products'
import { uploadAdminImage } from '@/lib/api/upload'
import { resolveMediaUrl } from '@/lib/media-url'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
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

/** Asset source → chip tone. Violet stays out of chips (rule 1). */
const SOURCE_TONE: Record<string, DcTone> = {
  product: 'info',
  banner: 'ok',
  category: 'warn',
}

const FILTERS = ['All', 'Product', 'Banner', 'Category'] as const
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
  const media = useMedia()
  const products = useProducts({ limit: 100 })
  const { api } = useAdminConnection(25_000)
  const fileRef = useRef<HTMLInputElement>(null)

  const [filter, setFilter] = useState<Filter>('All')
  const [deptFolder, setDeptFolder] = useState<MediaDeptFolder | 'all'>('all')
  const [query, setQuery] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploadFolder, setUploadFolder] = useState<MediaDeptFolder>('products')
  const [uploadName, setUploadName] = useState('')
  const [attachProductId, setAttachProductId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null)

  const resetUploadModal = () => {
    setPendingFile(null)
    setUploadFolder('products')
    setUploadName('')
    setAttachProductId('')
  }

  const stats = media.data?.stats
  const assets = useMemo(() => (media.data?.assets ?? []) as MediaAsset[], [media.data])
  const productOptions = products.data?.products ?? []

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return assets.filter((a) => {
      if (filter !== 'All' && (a.type ?? '').toLowerCase() !== filter.toLowerCase()) return false
      if (deptFolder !== 'all') {
        if (!a.url.includes(`/uploads/${deptFolder}/`)) return false
      }
      if (!q) return true
      return (
        a.name.toLowerCase().includes(q) ||
        (a.altText ?? '').toLowerCase().includes(q) ||
        (a.url ?? '').toLowerCase().includes(q)
      )
    })
  }, [assets, filter, query, deptFolder])

  const missingAlt = useMemo(() => assets.filter((a) => !a.altText?.trim()).length, [assets])
  const pageStatus = dcPageStatus([media], api.pulse)

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['platform-media'] })
    void media.refetch()
  }

  const uploadMut = useMutation({
    mutationFn: async ({
      file,
      productId,
      folder,
      name,
    }: {
      file: File
      productId: string | null
      folder: MediaDeptFolder
      name: string
    }) => {
      const displayName = name.trim() || file.name.replace(/\.[^.]+$/, '') || 'Library asset'
      const uploaded = await uploadAdminImage(file, folder)
      if (productId) {
        await addProductImage(productId, {
          url: uploaded.url,
          altText: displayName,
        })
        return { mode: 'product' as const, url: uploaded.url, folder, name: displayName }
      }
      await createBanner({
        image: uploaded.url,
        title: displayName,
        position: 'library',
        isActive: false,
      })
      return { mode: 'library' as const, url: uploaded.url, folder, name: displayName }
    },
    onSuccess: (res) => {
      resetUploadModal()
      setDeptFolder(res.folder === 'products' ? 'all' : res.folder)
      invalidate()
      toast(
        'ok',
        res.mode === 'product' ? 'Image attached to product' : 'Saved to media library',
        `${res.name} · ${res.folder}`,
      )
    },
    onError: (err) =>
      toast('bad', 'Upload failed', err instanceof Error ? err.message : 'Could not upload image'),
  })

  const deleteMut = useMutation({
    mutationFn: async (asset: MediaAsset) => {
      const type = (asset.type ?? '').toLowerCase()
      if (type === 'product') {
        if (!asset.productId) throw new Error('Missing product id for this image')
        await deleteProductImage(asset.productId, asset.id)
        return
      }
      if (type === 'banner') {
        await deleteBanner(asset.id)
        return
      }
      if (type === 'category') {
        await updateCategory(asset.id, { image: null })
        return
      }
      throw new Error(`Cannot delete ${type || 'unknown'} assets from here`)
    },
    onSuccess: () => {
      setDeleteTarget(null)
      invalidate()
      toast('ok', 'Removed', 'Asset deleted from the catalogue index.')
    },
    onError: (err) =>
      toast('bad', 'Delete failed', err instanceof Error ? err.message : 'Could not delete asset'),
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
        accept="image/jpeg,image/png,image/webp,image/avif"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null
          e.target.value = ''
          if (!file) return
          setAttachProductId('')
          setUploadFolder(deptFolder === 'all' ? 'products' : deptFolder)
          setUploadName(file.name.replace(/\.[^.]+$/, '') || '')
          setPendingFile(file)
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
            <Kpi label="Banners" value={String(stats?.banners ?? 0)} sub="hero and library" />
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
              {MEDIA_DEPT_FOLDERS.map((f) => {
                const value = f.key === 'all' ? 'all' : f.folder
                const on = deptFolder === value
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setDeptFolder(value as MediaDeptFolder | 'all')}
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
              {rows.length} of {assets.length}
            </span>
          </div>

          {rows.length === 0 ? (
            <div style={{ ...card, padding: '48px 20px', textAlign: 'center' }}>
              <span style={{ font: `400 12.5px/1.55 ${FONT}`, color: 'var(--ink-3)' }}>
                Nothing matches that filter.
              </span>
            </div>
          ) : (
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
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- R2/upload URLs; next/image is not wired for these
                      <img
                        src={url}
                        alt={a.altText || ''}
                        style={{
                          display: 'block',
                          width: '100%',
                          height: 132,
                          objectFit: 'cover',
                          borderRadius: 9,
                          border: '1px solid var(--line)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          display: 'grid',
                          placeItems: 'center',
                          height: 132,
                          borderRadius: 9,
                          border: '1px dashed var(--line-2)',
                          background:
                            'repeating-linear-gradient(135deg, var(--surface-2), var(--surface-2) 6px, var(--surface-3) 6px, var(--surface-3) 12px)',
                          color: 'var(--ink-3)',
                        }}
                      >
                        <DcIcon name="icon-image-off" size={16} />
                      </div>
                    )}

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
                      {a.productId ? (
                        <button
                          type="button"
                          title="Open product"
                          onClick={() => router.push(`/dashboard/products/${a.productId}/edit`)}
                          style={{
                            border: 0,
                            background: 'transparent',
                            color: 'var(--ink-3)',
                            cursor: 'pointer',
                            padding: 4,
                          }}
                        >
                          <DcIcon name="icon-external-link" size={13} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => setDeleteTarget(a)}
                        style={{
                          border: 0,
                          background: 'transparent',
                          color: 'var(--bad)',
                          cursor: 'pointer',
                          padding: 4,
                        }}
                      >
                        <DcIcon name="icon-trash-2" size={13} />
                      </button>
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
              Upload attaches to a product or saves as a library banner. Delete removes product
              images, library banners, or clears a category image — hero slides stay under Hero
              Slider.
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
        busyLabel="Uploading…"
        onClose={() => {
          if (uploadMut.isPending) return
          resetUploadModal()
        }}
        onConfirm={() => {
          if (!pendingFile) return
          uploadMut.mutate({
            file: pendingFile,
            productId: attachProductId || null,
            folder: uploadFolder,
            name: uploadName,
          })
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)', letterSpacing: '.06em' }}>
              MENU
            </span>
            <select
              value={uploadFolder}
              onChange={(e) => setUploadFolder(e.target.value as MediaDeptFolder)}
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
              {MEDIA_DEPT_FOLDERS.map((f) => (
                <option key={f.key} value={f.folder}>
                  {f.label}
                </option>
              ))}
            </select>
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
        onClose={() => {
          if (deleteMut.isPending) return
          setDeleteTarget(null)
        }}
        onConfirm={() => {
          if (!deleteTarget) return
          deleteMut.mutate(deleteTarget)
        }}
      />
    </>
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
