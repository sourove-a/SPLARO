'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { ExternalLink, Image as ImageIcon, Pencil, RefreshCw, SlidersHorizontal, Upload } from 'lucide-react'
import { HERO_DEFAULT_SLIDES, SPLARO_DOMAINS } from '@splaro/config'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { useBanners, useContentOverview, useFootwearConfig, useLegalPages, useSettings, useCreateBanner, useDeleteBanner, useUpdateBanner, useSitePages } from '@/lib/api/hooks'
import { resolveMediaUrl } from '@/lib/media-url'
import { ContentSubNav } from '@/components/content/ContentSubNav'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import { ModuleLiveStrip } from '@/components/ui/connection/ModuleLiveStrip'
import {
  BlogPanelLive, LookbooksPanelLive, ReelsPanelLive, CmsPanelLive,
  LandingPagesPanelLive, HomePagePanelLive, ThemeBuilderPanelLive,
} from '@/components/modules/ContentLivePanels'
import { LegalPagesPanel } from '@/components/modules/LegalPagesPanel'
import { FootwearPagePanel } from '@/components/content/FootwearPagePanel'
import { HeroSlideEditorModal, type HeroSlideFormValues } from '@/components/content/HeroSlideEditorModal'
import { MenuControlPanel } from '@/components/modules/SettingsPanel'
import { renderModuleSubPanel } from '@/components/modules/renderModuleSubPanel'

// ─── Design tokens ───────────────────────────────────────────────────────────
const GOLD = '#c8a97e'
const GOLD_LIGHT = 'rgba(200,169,126,0.10)'
const GOLD_BORDER = 'rgba(200,169,126,0.32)'


const TH: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--admin-table-row-border)', whiteSpace: 'nowrap' }
const TD: React.CSSProperties = { padding: '11px 16px', fontSize: 13, color: 'var(--admin-text-secondary)', borderBottom: '1px solid var(--admin-table-row-border)' }

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

const EMPTY_SLIDE_FORM: HeroSlideFormValues = {
  title: '',
  subtitle: '',
  linkUrl: '/shop',
  image: '',
}

function HeroSliderPanel() {
  const [query, setQuery] = useState('')
  const [importing, setImporting] = useState(false)
  const [editor, setEditor] = useState<{
    mode: 'create' | 'edit'
    slideId?: string
    values: HeroSlideFormValues
  } | null>(null)
  const { data: banners = [], isLoading, isError, refetch } = useBanners('hero')
  const createBanner = useCreateBanner()
  const deleteBanner = useDeleteBanner()
  const updateBanner = useUpdateBanner()

  const autoImportRef = useRef(false)

  const importLiveSlides = useCallback(async () => {
    for (let i = 0; i < HERO_DEFAULT_SLIDES.length; i++) {
      const slide = HERO_DEFAULT_SLIDES[i]!
      await createBanner.mutateAsync({
        image: slide.video ?? slide.image,
        title: slide.title,
        subtitle: slide.subtitle,
        linkUrl: slide.linkUrl,
        position: 'hero',
        isActive: true,
        sortOrder: i,
      })
    }
    await refetch()
  }, [createBanner, refetch])

  useEffect(() => {
    if (isLoading || isError || banners.length > 0 || autoImportRef.current) return
    const storageKey = 'splaro-hero-slides-seeded'
    if (typeof window !== 'undefined' && sessionStorage.getItem(storageKey) === '1') return

    autoImportRef.current = true
    if (typeof window !== 'undefined') sessionStorage.setItem(storageKey, 'pending')

    setImporting(true)
    void importLiveSlides()
      .then(() => {
        if (typeof window !== 'undefined') sessionStorage.setItem(storageKey, '1')
        toast.success('Live homepage slides loaded — এখন edit করতে পারবেন')
      })
      .catch((e) => {
        autoImportRef.current = false
        if (typeof window !== 'undefined') sessionStorage.removeItem(storageKey)
        toast.error(e instanceof Error ? e.message : 'Could not load live slides')
      })
      .finally(() => setImporting(false))
  }, [isLoading, isError, banners.length, importLiveSlides])

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
      isActive: b.isActive,
    })),
    [banners],
  )

  const usingFallback = !isLoading && slides.length === 0

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return slides.filter((s) => !q || s.title.toLowerCase().includes(q))
  }, [query, slides])

  const handleAddSlide = () => {
    setEditor({ mode: 'create', values: { ...EMPTY_SLIDE_FORM } })
  }

  const handleEditSlide = (slide: (typeof slides)[0]) => {
    setEditor({
      mode: 'edit',
      slideId: slide.id,
      values: {
        title: slide.title,
        subtitle: slide.cta,
        linkUrl: slide.link,
        image: slide.image,
      },
    })
  }

  const handleSaveSlide = (values: HeroSlideFormValues) => {
    if (editor?.mode === 'edit' && editor.slideId) {
      updateBanner.mutate(
        {
          id: editor.slideId,
          title: values.title,
          subtitle: values.subtitle,
          linkUrl: values.linkUrl,
          image: values.image,
        },
        {
          onSuccess: () => {
            toast.success('Slide updated')
            setEditor(null)
            void refetch()
          },
          onError: (e) => toast.error(e.message),
        },
      )
      return
    }

    createBanner.mutate(
      {
        image: values.image,
        title: values.title,
        subtitle: values.subtitle,
        linkUrl: values.linkUrl,
        position: 'hero',
        isActive: true,
      },
      {
        onSuccess: () => {
          toast.success('Hero slide added')
          setEditor(null)
          void refetch()
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  const handleImportDefaults = async () => {
    if (!window.confirm('Import live homepage slides into database so you can edit them?')) return
    setImporting(true)
    try {
      await importLiveSlides()
      if (typeof window !== 'undefined') sessionStorage.setItem('splaro-hero-slides-seeded', '1')
      toast.success('Live slides imported — edit below')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const slideActions = (slide: (typeof slides)[0]) => [
    {
      label: 'Edit slide',
      onClick: () => handleEditSlide(slide),
    },
    {
      label: slide.isActive ? 'Hide from homepage' : 'Publish on homepage',
      onClick: () => {
        updateBanner.mutate(
          { id: slide.id, isActive: !slide.isActive },
          {
            onSuccess: () => { toast.success(slide.isActive ? 'Slide hidden' : 'Slide is live'); void refetch() },
            onError: (e) => toast.error(e.message),
          },
        )
      },
    },
    {
      label: 'Delete slide',
      tone: 'danger' as const,
      onClick: () => {
        if (!window.confirm(`Delete "${slide.title}"?`)) return
        deleteBanner.mutate(slide.id, {
          onSuccess: () => { toast.success('Slide deleted'); void refetch() },
          onError: (e) => toast.error(e.message),
        })
      },
    },
  ]

  if (isError) {
    return <div className="settings-card admin-panel-glass-subtle admin-error-banner">Banners API offline — start pnpm dev:api on port 4000.</div>
  }

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ModuleLiveStrip
        onRefresh={() => void refetch()}
        refreshing={isLoading}
        items={[
          {
            label: 'Hero slider',
            value: isLoading ? '…' : usingFallback ? `${HERO_DEFAULT_SLIDES.length} default (live)` : `${slides.filter((s) => s.isActive).length} live slide(s)`,
            ok: !isError && !usingFallback,
            hint: usingFallback ? 'Import to edit in admin' : `${slides.length} in DB · GET /admin/banners`,
          },
          {
            label: 'Storefront feed',
            value: isError ? 'Unavailable' : 'Synced',
            ok: !isError,
            hint: 'GET /storefront/banners?position=hero',
          },
        ]}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <KpiCard label="Slides" value={isLoading ? '…' : usingFallback ? HERO_DEFAULT_SLIDES.length : slides.length} />
        <KpiCard label="Live" value={usingFallback ? HERO_DEFAULT_SLIDES.length : slides.filter((s) => s.status === 'published').length} />
        <KpiCard label="Hidden" value={slides.filter((s) => s.status === 'draft').length} />
        <KpiCard label="Source" value={isLoading ? '…' : usingFallback ? 'Built-in defaults' : 'Live API'} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="settings-card admin-panel-glass-subtle admin-glass-search-wrap" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', flex: 1, maxWidth: 360 }}>
          <SlidersHorizontal style={{ width: 14, height: 14, color: 'var(--admin-text-muted)', flexShrink: 0 }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search slide title…" className="admin-glass-search-input" />
        </div>
        <button type="button" onClick={() => void refetch()} className="admin-module-toolbar-btn">
          <RefreshCw style={{ width: 12, height: 12 }} /> Refresh
        </button>
        <Link href="/dashboard/media-library" className="admin-module-toolbar-btn" style={{ textDecoration: 'none' }}>
          <ExternalLink style={{ width: 12, height: 12 }} /> Media library
        </Link>
        <Link href={`${SPLARO_DOMAINS.site}/`} target="_blank" rel="noreferrer" className="admin-module-toolbar-btn" style={{ textDecoration: 'none' }}>
          <ExternalLink style={{ width: 12, height: 12 }} /> View live homepage
        </Link>
        <button type="button" onClick={handleAddSlide} style={{ background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, color: 'var(--admin-text-secondary)', borderRadius: 12, padding: '8px 16px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
          Add slide
        </button>
      </div>

      {usingFallback ? (
        <div className="settings-card admin-panel-glass-subtle" style={{ padding: 16, border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)' }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: 'var(--admin-text-primary)' }}>
            Homepage-এ যা দেখছেন সেটা database slide না — built-in default slides
          </p>
          <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)', lineHeight: 1.5 }}>
            Import করলে নিচের {HERO_DEFAULT_SLIDES.length}টা slide database-এ যাবে। তারপর title, image, link সব edit করতে পারবেন।
          </p>
          <button
            type="button"
            disabled={importing}
            onClick={() => void handleImportDefaults()}
            style={{ background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, color: 'var(--admin-text-secondary)', borderRadius: 12, padding: '10px 18px', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <Upload style={{ width: 14, height: 14 }} />
            {importing ? 'Importing…' : 'Import live slides to edit'}
          </button>
        </div>
      ) : null}

      {usingFallback ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {HERO_DEFAULT_SLIDES.map((slide) => (
            <article key={slide.key} className="settings-card admin-panel-glass" style={{ padding: 0, overflow: 'hidden', opacity: 0.92 }}>
              <div style={{ position: 'relative', aspectRatio: '16/9', background: 'var(--admin-surface-input)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={slide.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <span style={{ position: 'absolute', left: 8, top: 8, borderRadius: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 8px' }}>LIVE DEFAULT</span>
              </div>
              <div style={{ padding: '10px 14px' }}>
                <p style={{ fontSize: 12, fontWeight: 900, margin: 0 }}>{slide.title}</p>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--admin-text-muted)', margin: '4px 0 0' }}>{slide.subtitle}</p>
                <p style={{ fontSize: 10, fontFamily: 'monospace', color: GOLD, margin: '4px 0 0' }}>{slide.linkUrl}</p>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {slides.length > 0 ? (
      <div className="settings-card admin-panel-glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="admin-module-table-header" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SlidersHorizontal style={{ width: 13, height: 13, color: GOLD }} />
          </div>
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--admin-text-primary)', flex: 1, margin: 0 }}>Hero slides · {filtered.length}</p>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--admin-text-muted)', margin: 0 }}>{slides.filter((s) => s.status === 'published').length} live on homepage</p>
        </div>
        {isLoading ? (
          <p style={{ padding: '20px', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>Loading banners…</p>
        ) : filtered.length === 0 && !usingFallback ? (
          <div style={{ padding: '40px 32px', textAlign: 'center' }}>
            <ImageIcon style={{ width: 32, height: 32, color: 'rgba(200,169,126,0.4)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-text-muted)', margin: 0 }}>No hero banners yet. Click &quot;Add slide&quot; or upload in Media Library.</p>
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
                      <img src={resolveMediaUrl(s.image)} alt="" style={{ width: 64, height: 40, borderRadius: 8, border: '1px solid var(--admin-table-row-border)', objectFit: 'cover' }} />
                    </td>
                    <td style={{ ...TD, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{s.title}</td>
                    <td style={{ ...TD, fontSize: 12, fontWeight: 800, color: GOLD }}>{s.cta}</td>
                    <td style={{ ...TD, fontFamily: 'monospace', fontSize: 10 }}>{s.link}</td>
                    <td style={{ ...TD, fontSize: 12 }}>{s.schedule}</td>
                    <td style={TD}><StatusPill value={s.status} /></td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" title="Edit slide" onClick={() => handleEditSlide(s)} style={{ border: '1px solid var(--admin-glass-border)', background: 'transparent', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                          <Pencil style={{ width: 12, height: 12, color: GOLD }} />
                        </button>
                        <RowActionsMenu recordName={s.title} moduleHref="/dashboard/hero-slider" recordId={s.id} actions={slideActions(s)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      ) : null}

      <HeroSlideEditorModal
        open={editor !== null}
        mode={editor?.mode ?? 'edit'}
        initial={editor?.values ?? EMPTY_SLIDE_FORM}
        saving={createBanner.isPending || updateBanner.isPending}
        onClose={() => setEditor(null)}
        onSave={handleSaveSlide}
      />
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
  const sitePages = useSitePages()
  const legalPages = useLegalPages()
  const settings = useSettings()
  const banners = useBanners('hero')
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
      '/dashboard/landing-pages': routeStatus(sitePages.isLoading, sitePages.isError),
    } as const
  }, [content, legalPages, settings, banners, footwear, sitePages])

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
