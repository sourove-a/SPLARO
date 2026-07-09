'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Film, Image as ImageIcon, Search, Trash2, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { useCreateBanner, useDeleteBanner, useMedia, useUpdateCategory, usePermission } from '@/lib/api/hooks'
import { deleteProductImage } from '@/lib/api/products'
import { MediaUploadZone } from '@/components/media/MediaUploadZone'
import { resolveMediaUrl } from '@/lib/media-url'

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

// ─── Design tokens ───────────────────────────────────────────────────────────
const GOLD = '#c8a97e'
const GOLD_LIGHT = 'rgba(200,169,126,0.10)'
const GOLD_BORDER = 'rgba(200,169,126,0.32)'


function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="settings-card admin-panel-glass-subtle" style={{ padding: '16px 18px' }}>
      <p style={{ fontSize: 18, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0 }}>{value}</p>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4, marginBottom: 0 }}>{label}</p>
    </div>
  )
}

export function MediaModulePanel({ moduleHref }: ModuleContextProps) {
  const { data, isError, isLoading, refetch } = useMedia()
  const createBanner = useCreateBanner()
  const deleteBanner = useDeleteBanner()
  const updateCategory = useUpdateCategory()
  const [query, setQuery] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const canDeleteSettings = usePermission('settings', 'delete')
  const canDeleteProducts = usePermission('products', 'delete')
  const canEditProducts = usePermission('products', 'edit')

  const canDeleteAsset = (asset: MediaAsset) => {
    if (asset.type === 'banner') return canDeleteSettings
    if (asset.type === 'product') return canDeleteProducts
    if (asset.type === 'category') return canEditProducts
    return false
  }

  const assets = useMemo(() => {
    const list = data?.assets ?? []
    const q = query.toLowerCase()
    let filtered = q ? list.filter((a) => a.name.toLowerCase().includes(q) || a.source.toLowerCase().includes(q)) : list
    if (moduleHref === '/dashboard/video-library') filtered = filtered.filter((a) => /\.(mp4|webm|mov)/i.test(a.url))
    if (moduleHref === '/dashboard/ugc-gallery') filtered = filtered.filter((a) => a.type === 'banner')
    return filtered
  }, [data, query, moduleHref])

  const handleUploadBanner = (url: string) => {
    const title = window.prompt('Banner title (optional)')?.trim()
    createBanner.mutate(
      { image: url, ...(title ? { title } : {}), position: 'hero', isActive: true },
      { onSuccess: () => { toast.success('Hero banner saved'); refetch() }, onError: (e) => toast.error(e.message) },
    )
  }

  const handleUploadLibrary = (url: string) => {
    const title = window.prompt('Image name (optional)')?.trim() || 'Library image'
    createBanner.mutate(
      { image: url, title, position: 'library', isActive: false },
      { onSuccess: () => { toast.success('Saved to media library'); refetch() }, onError: (e) => toast.error(e.message) },
    )
  }

  const handleDelete = async (asset: MediaAsset) => {
    if (!window.confirm(`Delete "${asset.name}" from media library?`)) return
    setDeletingId(asset.id)
    try {
      if (asset.type === 'banner') {
        await deleteBanner.mutateAsync(asset.id)
      } else if (asset.type === 'product' && asset.productId) {
        await deleteProductImage(asset.productId, asset.id)
      } else if (asset.type === 'category') {
        await updateCategory.mutateAsync({ id: asset.id, image: null })
      } else {
        toast.error('Cannot delete this asset type.')
        return
      }
      toast.success('Image deleted')
      void refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  const assetHref = (asset: MediaAsset) => {
    if (asset.type === 'product' && asset.productId) {
      return `/dashboard/products/${asset.productId}`
    }
    return null
  }

  if (isError) return <div className="settings-card admin-panel-glass-subtle admin-error-banner">Media API offline — start pnpm dev:api</div>

  const stats = data?.stats

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <KpiCard label="Total assets" value={isLoading ? '…' : stats?.total ?? 0} />
        <KpiCard label="Product images" value={isLoading ? '…' : stats?.products ?? 0} />
        <KpiCard label="Banners" value={isLoading ? '…' : stats?.banners ?? 0} />
        <KpiCard label="Categories" value={isLoading ? '…' : stats?.categories ?? 0} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <MediaUploadZone folder="banners" label="Upload hero banner" onUploaded={handleUploadBanner} />
        <MediaUploadZone folder="media" label="Upload to library" onUploaded={handleUploadLibrary} />
      </div>

      <div className="settings-card admin-panel-glass-subtle admin-glass-search-wrap" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', maxWidth: 360 }}>
        <Search style={{ width: 14, height: 14, color: 'var(--admin-text-muted)', flexShrink: 0 }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search media…" className="admin-glass-search-input" />
      </div>

      {assets.length === 0 && !isLoading ? (
        <div className="settings-card admin-panel-glass" style={{ padding: '40px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ImageIcon style={{ width: 22, height: 22, color: GOLD }} />
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-text-muted)', margin: 0 }}>No media yet. Upload above — hero banners appear on homepage, library images stay here until you use them.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {assets.map((asset) => {
            const href = assetHref(asset)
            return (
            <article key={`${asset.type}-${asset.id}`} className="settings-card admin-panel-glass admin-media-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ position: 'relative', aspectRatio: '4/3', background: 'var(--admin-surface-input)' }}>
                {/\.(mp4|webm|mov)/i.test(asset.url) ? (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                    <Film style={{ width: 40, height: 40, color: GOLD }} />
                  </div>
                ) : href ? (
                  <Link href={href} className="admin-media-card__link">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resolveMediaUrl(asset.url)} alt={asset.altText || asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </Link>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveMediaUrl(asset.url)} alt={asset.altText || asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                {canDeleteAsset(asset) && (
                  <button
                    type="button"
                    disabled={deletingId === asset.id}
                    onClick={() => void handleDelete(asset)}
                    title="Delete image"
                    className="admin-media-delete-btn"
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                )}
              </div>
              <div style={{ padding: '10px 14px' }}>
                <p style={{ fontSize: 13, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</p>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--admin-text-muted)', margin: '2px 0 0' }}>{asset.source}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--admin-text-muted)', margin: 0 }}>{asset.updated}</p>
                  {href ? (
                    <Link href={href} className="admin-media-card__edit" style={{ fontSize: 10, fontWeight: 800, color: GOLD, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Edit product <ExternalLink style={{ width: 10, height: 10 }} />
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
            )
          })}
        </div>
      )}

      {moduleHref === '/dashboard/ugc-gallery' ? (
        <div className="settings-card admin-panel-glass-subtle" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Users style={{ width: 16, height: 16, color: GOLD, flexShrink: 0 }} />
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)', margin: 0 }}>
            UGC from social channels will appear here when connected via Integrations.
          </p>
        </div>
      ) : null}
    </div>
  )
}
