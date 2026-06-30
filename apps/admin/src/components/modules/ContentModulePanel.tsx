'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { ExternalLink, Image as ImageIcon, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { useBanners, useContentOverview, useFootwearConfig, useLegalPages, useSettings } from '@/lib/api/hooks'
import { resolveMediaUrl } from '@/lib/media-url'
import { ContentSubNav } from '@/components/content/ContentSubNav'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import {
  BlogPanelLive, LookbooksPanelLive, ReelsPanelLive, CmsPanelLive,
  LandingPagesPanelLive, HomePagePanelLive, ThemeBuilderPanelLive,
} from '@/components/modules/ContentLivePanels'
import { LegalPagesPanel } from '@/components/modules/LegalPagesPanel'
import { FootwearPagePanel } from '@/components/content/FootwearPagePanel'
import { MenuControlPanel } from '@/components/modules/SettingsPanel'
import { renderModuleSubPanel } from '@/components/modules/renderModuleSubPanel'

// ─── Design tokens ───────────────────────────────────────────────────────────
const GOLD = '#5E7CFF'
const GOLD_LIGHT = 'rgba(200,169,126,0.10)'
const GOLD_BORDER = 'rgba(200,169,126,0.32)'


const TH: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }
const TD: React.CSSProperties = { padding: '11px 16px', fontSize: 13, color: 'var(--admin-text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.4)' }

type PubStatus = 'published' | 'draft' | 'scheduled' | 'archived'

function StatusPill({ value }: { value: string }) {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    published: { bg: 'rgba(22,163,74,0.10)',   text: '#15803D', border: 'rgba(22,163,74,0.30)' },
    draft:     { bg: 'rgba(245,158,11,0.10)',  text: '#B45309', border: 'rgba(245,158,11,0.30)' },
    scheduled: { bg: 'rgba(59,130,246,0.10)',  text: '#1D4ED8', border: 'rgba(59,130,246,0.30)' },
    archived:  { bg: 'rgba(156,163,175,0.10)', text: '#4B5563', border: 'rgba(156,163,175,0.30)' },
  }
  const fallback = { bg: 'rgba(156,163,175,0.10)', text: '#4B5563', border: 'rgba(156,163,175,0.30)' }
  const s = map[value.toLowerCase()] ?? fallback
  return <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text, borderRadius: 8, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>{value}</span>
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="settings-card admin-panel-glass-subtle" style={{ padding: '16px 18px' }}>
      <p style={{ fontSize: 18, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0 }}>{value}</p>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4, marginBottom: 0 }}>{label}</p>
    </div>
  )
}

function HeroSliderPanel() {
  const [query, setQuery] = useState('')
  const { data: banners = [], isLoading, isError, refetch } = useBanners()

  const slides = useMemo(
    () => banners.map((b, index) => ({
      id: b.id,
      title: b.title ?? `Slide ${index + 1}`,
      cta: b.subtitle ?? 'Shop now',
      link: b.linkUrl ?? '/',
      order: index + 1,
      status: (b.isActive ? 'published' : 'draft') as PubStatus,
      schedule: b.isActive ? 'Live' : 'Hidden',
      image: b.image,
    })),
    [banners],
  )

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return slides.filter((s) => !q || s.title.toLowerCase().includes(q))
  }, [query, slides])

  if (isError) {
    return <div className="settings-card admin-panel-glass-subtle" style={{ padding: '12px 16px', borderLeft: '3px solid #EF4444', color: '#B91C1C', fontSize: 13, fontWeight: 700 }}>Banners API offline — start pnpm dev:api on port 4000.</div>
  }

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <KpiCard label="Slides" value={isLoading ? '…' : slides.length} />
        <KpiCard label="Live" value={slides.filter((s) => s.status === 'published').length} />
        <KpiCard label="Hidden" value={slides.filter((s) => s.status === 'draft').length} />
        <KpiCard label="Source" value="Live API" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="settings-card admin-panel-glass-subtle" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', flex: 1, maxWidth: 360 }}>
          <SlidersHorizontal style={{ width: 14, height: 14, color: 'var(--admin-text-muted)', flexShrink: 0 }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search slide title…" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-primary)' }} />
        </div>
        <button type="button" onClick={() => void refetch()} className="settings-card admin-panel-glass-subtle" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: 'var(--admin-text-secondary)', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.72)' }}>
          <RefreshCw style={{ width: 12, height: 12 }} /> Refresh
        </button>
        <Link href="/dashboard/media-library" className="settings-card admin-panel-glass-subtle" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: 'var(--admin-text-secondary)', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.72)' }}>
          <ExternalLink style={{ width: 12, height: 12 }} /> Media library
        </Link>
        <button type="button" onClick={() => toast.error('This action is not available yet — feature pending.')} style={{ background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, color: '#8B6914', borderRadius: 12, padding: '8px 16px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
          Add slide
        </button>
      </div>

      <div className="settings-card admin-panel-glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SlidersHorizontal style={{ width: 13, height: 13, color: GOLD }} />
          </div>
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--admin-text-primary)', flex: 1, margin: 0 }}>Hero slides · {filtered.length}</p>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--admin-text-muted)', margin: 0 }}>{slides.filter((s) => s.status === 'published').length} live on homepage</p>
        </div>
        {isLoading ? (
          <p style={{ padding: '20px', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>Loading banners…</p>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px 32px', textAlign: 'center' }}>
            <ImageIcon style={{ width: 32, height: 32, color: 'rgba(200,169,126,0.4)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-text-muted)', margin: 0 }}>No hero banners yet. Upload in Media Library to create one.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Order', 'Preview', 'Title', 'CTA', 'Link', 'Schedule', 'Status', ''].map((h) => <th key={h} style={TH}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td style={{ ...TD, fontWeight: 900 }}>{s.order}</td>
                    <td style={TD}>
                      <img src={resolveMediaUrl(s.image)} alt="" style={{ width: 64, height: 40, borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)', objectFit: 'cover' }} />
                    </td>
                    <td style={{ ...TD, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{s.title}</td>
                    <td style={{ ...TD, fontSize: 12, fontWeight: 800, color: GOLD }}>{s.cta}</td>
                    <td style={{ ...TD, fontFamily: 'monospace', fontSize: 10 }}>{s.link}</td>
                    <td style={{ ...TD, fontSize: 12 }}>{s.schedule}</td>
                    <td style={TD}><StatusPill value={s.status} /></td>
                    <td style={TD}><RowActionsMenu recordName={s.title} moduleHref="/dashboard/hero-slider" recordId={s.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const PANELS: Record<string, () => React.ReactNode> = {
  '/dashboard/home-page': HomePagePanelLive,
  '/dashboard/footwear-page': FootwearPagePanel,
  '/dashboard/theme-builder': ThemeBuilderPanelLive,
  '/dashboard/menu-control': MenuControlPanel,
  '/dashboard/hero-slider': HeroSliderPanel,
  '/dashboard/lookbooks': LookbooksPanelLive,
  '/dashboard/reels': ReelsPanelLive,
  '/dashboard/blog': BlogPanelLive,
  '/dashboard/legal-pages': LegalPagesPanel,
  '/dashboard/cms': CmsPanelLive,
  '/dashboard/landing-pages': LandingPagesPanelLive,
}

function routeStatus(loading: boolean, error: boolean): 'ok' | 'down' | 'loading' {
  if (loading) return 'loading'
  if (error) return 'down'
  return 'ok'
}

export function ContentModulePanel(props: ModuleContextProps) {
  const { moduleHref } = props
  const content = useContentOverview()
  const legalPages = useLegalPages()
  const settings = useSettings()
  const banners = useBanners()
  const footwear = useFootwearConfig()

  const statusByHref = useMemo(() => {
    const contentSt = routeStatus(content.isLoading, content.isError)
    const settingsSt = routeStatus(settings.isLoading, settings.isError)
    const bannersSt = routeStatus(banners.isLoading, banners.isError)
    const footwearSt = routeStatus(footwear.isLoading, footwear.isError)
    const legalSt = routeStatus(legalPages.isLoading, legalPages.isError)
    return {
      '/dashboard/home-page': contentSt === 'ok' && settingsSt === 'ok' ? 'ok' : contentSt === 'loading' || settingsSt === 'loading' ? 'loading' : 'down',
      '/dashboard/footwear-page': footwearSt,
      '/dashboard/theme-builder': settingsSt,
      '/dashboard/menu-control': settingsSt,
      '/dashboard/hero-slider': bannersSt,
      '/dashboard/lookbooks': contentSt,
      '/dashboard/reels': contentSt,
      '/dashboard/blog': contentSt,
      '/dashboard/legal-pages': legalSt,
      '/dashboard/cms': contentSt,
      '/dashboard/landing-pages': contentSt,
    } as const
  }, [content, legalPages, settings, banners, footwear])

  const Panel = PANELS[moduleHref]
  const anyDown = Object.values(statusByHref).some((s) => s === 'down')

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ContentSubNav activeHref={moduleHref} statusByHref={statusByHref} />
      {anyDown && moduleHref !== '/dashboard/footwear-page' && content.isError ? (
        <ApiOfflineBanner message="Content API offline — run pnpm dev:api on port 4000." />
      ) : null}
      {renderModuleSubPanel(Panel, props)}
    </div>
  )
}
