'use client'

import { useMemo, useState } from 'react'
import { Film, Image as ImageIcon, Search, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { useCreateBanner, useMedia } from '@/lib/api/hooks'
import { MediaUploadZone } from '@/components/media/MediaUploadZone'
import { resolveMediaUrl } from '@/lib/media-url'

// ─── Design tokens ───────────────────────────────────────────────────────────
const GOLD = '#5E7CFF'
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
  const [query, setQuery] = useState('')

  const assets = useMemo(() => {
    const list = data?.assets ?? []
    const q = query.toLowerCase()
    let filtered = q ? list.filter((a) => a.name.toLowerCase().includes(q) || a.source.toLowerCase().includes(q)) : list
    if (moduleHref === '/dashboard/video-library') filtered = filtered.filter((a) => /\.(mp4|webm|mov)/i.test(a.url))
    if (moduleHref === '/dashboard/ugc-gallery') filtered = filtered.filter((a) => a.type === 'banner')
    return filtered
  }, [data, query, moduleHref])

  const handleUpload = (url: string) => {
    const title = window.prompt('Banner title (optional)')?.trim()
    createBanner.mutate(
      { image: url, ...(title ? { title } : {}), position: 'hero' },
      { onSuccess: () => { toast.success('Banner saved to database'); refetch() }, onError: (e) => toast.error(e.message) },
    )
  }

  if (isError) return <div className="settings-card admin-panel-glass-subtle" style={{ padding: '12px 16px', borderLeft: '3px solid #EF4444', color: '#B91C1C', fontSize: 13, fontWeight: 700 }}>Media API offline — start pnpm dev:api</div>

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
        <MediaUploadZone folder="banners" label="Upload banner image" onUploaded={handleUpload} />
        <MediaUploadZone folder="media" label="Upload to library" onUploaded={() => { toast.success('File saved — add to a product or banner to show in library'); refetch() }} />
      </div>

      <div className="settings-card admin-panel-glass-subtle" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', maxWidth: 360 }}>
        <Search style={{ width: 14, height: 14, color: 'var(--admin-text-muted)', flexShrink: 0 }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search media…" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-primary)' }} />
      </div>

      {assets.length === 0 && !isLoading ? (
        <div className="settings-card admin-panel-glass" style={{ padding: '40px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ImageIcon style={{ width: 22, height: 22, color: GOLD }} />
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-text-muted)', margin: 0 }}>No media yet. Upload a banner above or add images when creating products.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {assets.map((asset) => (
            <article key={asset.id} className="settings-card admin-panel-glass" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ position: 'relative', aspectRatio: '4/3', background: 'rgba(0,0,0,0.05)' }}>
                {/\.(mp4|webm|mov)/i.test(asset.url) ? (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                    <Film style={{ width: 40, height: 40, color: GOLD }} />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveMediaUrl(asset.url)} alt={asset.altText || asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
              <div style={{ padding: '10px 14px' }}>
                <p style={{ fontSize: 13, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</p>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--admin-text-muted)', margin: '2px 0 0' }}>{asset.source}</p>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--admin-text-muted)', margin: '2px 0 0' }}>{asset.updated}</p>
              </div>
            </article>
          ))}
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
