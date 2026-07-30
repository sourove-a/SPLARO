'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import { toastFail, toastInfo } from '@/lib/admin/feedback'
import {
  confirmBannerDeleted,
  confirmBannerSaved,
} from '@/lib/admin/catalog-save'
import { ExternalLink, Film, Image as ImageIcon, Pencil, SlidersHorizontal, Upload } from 'lucide-react'
import { HERO_DEFAULT_SLIDES, SPLARO_DOMAINS } from '@splaro/config'
import { AdminButton } from '@/components/ui/AdminButton'
import { AdminDataTable } from '@/components/ui/AdminDataTable'
import { PremiumPanelShell } from '@/components/ui/PremiumPanelShell'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { useBanners, useContentOverview, useFootwearConfig, useLegalPages, useSettings, useCreateBanner, useDeleteBanner, useUpdateBanner, useSitePages } from '@/lib/api/hooks'
import { ContentSubNav } from '@/components/content/ContentSubNav'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import { ModuleLiveStrip } from '@/components/ui/connection/ModuleLiveStrip'
import { BetaBanner } from '@/components/ui/AdminHandoffBlocks'
import {
  BlogPanelLive, LookbooksPanelLive, ReelsPanelLive, CmsPanelLive,
  LandingPagesPanelLive, ThemeBuilderPanelLive,
} from '@/components/modules/ContentLivePanels'
import { LegalPagesPanel } from '@/components/modules/LegalPagesPanel'
import { FootwearPagePanel } from '@/components/content/FootwearPagePanel'
import {
  HeroSlideEditorModal,
  heroSlidePreview,
  isHeroMediaVideoUrl,
  type HeroSlideFormValues,
} from '@/components/content/HeroSlideEditorModal'
import { HomePageControlPanel, MenuControlPanel } from '@/components/modules/SettingsPanel'
import { renderModuleSubPanel } from '@/components/modules/renderModuleSubPanel'

function HeroSlideThumb({ src, title }: { src: string; title: string }) {
  const preview = heroSlidePreview(src)
  const video = isHeroMediaVideoUrl(src)
  return (
    <div
      className="relative overflow-hidden rounded-lg border border-[var(--admin-table-row-border)] bg-[var(--admin-surface-input)]"
      style={{ width: 72, height: 44 }}
      title={title}
    >
      {preview.kind === 'video' && preview.src ? (
        <video src={preview.src} muted playsInline preload="metadata" className="h-full w-full object-cover" />
      ) : preview.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview.src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <ImageIcon className="h-4 w-4 text-[var(--admin-text-muted)]" />
        </div>
      )}
      {video ? (
        <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 p-0.5 text-white">
          <Film className="h-2.5 w-2.5" aria-hidden />
        </span>
      ) : null}
    </div>
  )
}

type PubStatus = 'published' | 'draft' | 'scheduled' | 'archived'

function StatusPill({ value }: { value: string }) {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    published: { bg: 'rgba(22,163,74,0.10)',   text: 'var(--admin-success-ink)', border: 'rgba(22,163,74,0.30)' },
    draft:     { bg: 'rgba(245,158,11,0.10)',  text: 'var(--admin-warning-ink)', border: 'rgba(245,158,11,0.30)' },
    scheduled: { bg: 'rgba(59,130,246,0.10)',  text: 'var(--admin-c-1d4ed8)', border: 'rgba(59,130,246,0.30)' },
    archived:  { bg: 'rgba(156,163,175,0.10)', text: 'var(--admin-c-4b5563)', border: 'rgba(156,163,175,0.30)' },
  }
  const fallback = { bg: 'rgba(156,163,175,0.10)', text: 'var(--admin-c-4b5563)', border: 'rgba(156,163,175,0.30)' }
  const s = map[value.toLowerCase()] ?? fallback
  return <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text, borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>{value}</span>
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

  const handleSaveSlide = async (values: HeroSlideFormValues) => {
    if (editor?.mode === 'edit' && editor.slideId) {
      const ok = await confirmBannerSaved(
        editor.slideId,
        { title: values.title, image: values.image },
        () =>
          updateBanner.mutateAsync({
            id: editor.slideId!,
            title: values.title,
            subtitle: values.subtitle,
            linkUrl: values.linkUrl,
            image: values.image,
          }),
        'Slide',
      )
      if (ok) {
        setEditor(null)
        void refetch()
      }
      return
    }

    const ok = await confirmBannerSaved(
      null,
      { title: values.title, isActive: true, image: values.image },
      () =>
        createBanner.mutateAsync({
          image: values.image,
          title: values.title,
          subtitle: values.subtitle,
          linkUrl: values.linkUrl,
          position: 'hero',
          isActive: true,
        }),
      'Hero slide',
    )
    if (ok) {
      setEditor(null)
      void refetch()
    }
  }

  const handleImportDefaults = async () => {
    if (!window.confirm('Import live homepage slides into database so you can edit them?')) return
    setImporting(true)
    try {
      await importLiveSlides()
      if (typeof window !== 'undefined') sessionStorage.setItem('splaro-hero-slides-seeded', '1')
      toastInfo('Live slides imported — edit below')
    } catch (e) {
      toastFail(e instanceof Error ? e.message : 'Import failed')
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
        void (async () => {
          const next = !slide.isActive
          const ok = await confirmBannerSaved(
            slide.id,
            { isActive: next },
            () => updateBanner.mutateAsync({ id: slide.id, isActive: next }),
            slide.isActive ? 'Slide hidden' : 'Slide live',
          )
          if (ok) void refetch()
        })()
      },
    },
    {
      label: 'Delete slide',
      tone: 'danger' as const,
      onClick: () => {
        if (!window.confirm(`Delete "${slide.title}"?`)) return
        void (async () => {
          const ok = await confirmBannerDeleted(slide.id, () => deleteBanner.mutateAsync(slide.id))
          if (ok) void refetch()
        })()
      },
    },
  ]

  if (isError) {
    return <div className="settings-card admin-panel-glass-subtle admin-error-banner">Banners API offline — start pnpm dev:api on port 4000.</div>
  }

  const liveCount = usingFallback ? HERO_DEFAULT_SLIDES.length : slides.filter((s) => s.status === 'published').length
  const hiddenCount = slides.filter((s) => s.status === 'draft').length

  return (
    <>
      <PremiumPanelShell
        title="Hero slider"
        icon={SlidersHorizontal}
        liveStrip={
          <ModuleLiveStrip
            onRefresh={() => void refetch()}
            refreshing={isLoading}
            items={[
              {
                label: 'Hero slider',
                value: isLoading
                  ? '…'
                  : usingFallback
                    ? `${HERO_DEFAULT_SLIDES.length} default (live)`
                    : `${slides.filter((s) => s.isActive).length} live slide(s)`,
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
        }
        kpis={[
          { label: 'Slides', value: isLoading ? '…' : usingFallback ? HERO_DEFAULT_SLIDES.length : slides.length },
          { label: 'Live', value: liveCount, accent: 'success' },
          { label: 'Hidden', value: hiddenCount, ...(hiddenCount > 0 ? { accent: 'warning' as const } : {}) },
          { label: 'Source', value: isLoading ? '…' : usingFallback ? 'Defaults' : 'Live API', accent: 'accent' },
        ]}
        query={query}
        onQuery={setQuery}
        searchPlaceholder="Search slide title…"
        onRefresh={() => void refetch()}
        refreshing={isLoading}
        onCreate={handleAddSlide}
        createLabel="Add slide"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/media-library" className="admin-module-toolbar-btn no-underline">
              <ExternalLink style={{ width: 12, height: 12 }} /> Media
            </Link>
            <Link
              href={`${SPLARO_DOMAINS.site}/`}
              target="_blank"
              rel="noreferrer"
              className="admin-module-toolbar-btn no-underline"
            >
              <ExternalLink style={{ width: 12, height: 12 }} /> Live site
            </Link>
          </div>
        }
        tableTitle={usingFallback ? 'Live defaults (read-only)' : `Hero slides · ${filtered.length}`}
        tableIcon={SlidersHorizontal}
        footer={`${liveCount} live on homepage`}
        alert={
          usingFallback ? (
            <div className="settings-card admin-panel-glass-subtle mb-4 border border-amber-500/35 bg-amber-500/10 p-4">
              <p className="m-0 mb-2 text-[13px] font-extrabold text-[var(--admin-text-primary)]">
                Homepage currently uses built-in default slides — not database rows
              </p>
              <p className="mb-3 mt-0 text-[12px] font-semibold leading-relaxed text-[var(--admin-text-muted)]">
                Import {HERO_DEFAULT_SLIDES.length} slides into the database to edit title, media, and links from admin.
              </p>
              <AdminButton
                variant="accent"
                size="sm"
                disabled={importing}
                loading={importing}
                onClick={() => void handleImportDefaults()}
              >
                <Upload style={{ width: 14, height: 14 }} />
                {importing ? 'Importing…' : 'Import live slides to edit'}
              </AdminButton>
            </div>
          ) : null
        }
      >
        {usingFallback ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {HERO_DEFAULT_SLIDES.map((slide) => (
              <article key={slide.key} className="overflow-hidden rounded-[14px] border border-[var(--admin-glass-border)] bg-[var(--admin-surface-input)]">
                <div className="relative aspect-video bg-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={slide.image} alt="" className="h-full w-full object-cover" />
                  <span className="absolute left-2 top-2 rounded-md bg-black/55 px-2 py-1 text-[10px] font-semibold text-white">
                    LIVE DEFAULT
                  </span>
                </div>
                <div className="space-y-1 px-3.5 py-2.5">
                  <p className="m-0 text-[12px] font-semibold text-[var(--admin-text-primary)]">{slide.title}</p>
                  <p className="m-0 text-[10px] font-semibold text-[var(--admin-text-muted)]">{slide.subtitle}</p>
                  <p className="m-0 font-mono text-[10px] text-[var(--admin-text-secondary)]">{slide.linkUrl}</p>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {slides.length > 0 ? (
          <AdminDataTable
            loading={isLoading}
            rows={filtered}
            rowKey={(s) => s.id}
            empty={
              <div className="px-8 py-6 text-center">
                <ImageIcon className="mx-auto mb-3 h-8 w-8 text-[var(--admin-text-muted)]" />
                <p className="m-0 text-[13px] font-semibold text-[var(--admin-text-muted)]">
                  No matching slides. Clear search or add a new slide.
                </p>
              </div>
            }
            columns={[
              {
                key: 'order',
                header: 'Order',
                cell: (s) => <span className="font-semibold text-[var(--admin-text-primary)]">{s.order}</span>,
              },
              {
                key: 'preview',
                header: 'Preview',
                cell: (s) => <HeroSlideThumb src={s.image} title={s.title} />,
              },
              {
                key: 'title',
                header: 'Title',
                cell: (s) => <span className="font-semibold text-[var(--admin-text-primary)]">{s.title}</span>,
              },
              {
                key: 'cta',
                header: 'CTA',
                cell: (s) => <span className="text-xs font-semibold">{s.cta}</span>,
              },
              {
                key: 'link',
                header: 'Link',
                cell: (s) => <span className="font-mono text-[10px]">{s.link}</span>,
              },
              {
                key: 'schedule',
                header: 'Schedule',
                cell: (s) => <span className="text-xs">{s.schedule}</span>,
              },
              {
                key: 'status',
                header: 'Status',
                cell: (s) => <StatusPill value={s.status} />,
              },
              {
                key: 'actions',
                header: '',
                cell: (s) => (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      title="Edit slide"
                      onClick={() => handleEditSlide(s)}
                      className="rounded-lg border border-[var(--admin-glass-border)] bg-transparent p-1.5 transition hover:bg-black/[0.04]"
                    >
                      <Pencil className="h-3 w-3 text-[var(--admin-text-primary)]" />
                    </button>
                    <RowActionsMenu
                      recordName={s.title}
                      moduleHref="/dashboard/hero-slider"
                      recordId={s.id}
                      actions={slideActions(s)}
                    />
                  </div>
                ),
              },
            ]}
          />
        ) : !usingFallback && !isLoading ? (
          <div className="px-8 py-10 text-center">
            <ImageIcon className="mx-auto mb-3 h-8 w-8 text-[var(--admin-text-muted)]" />
            <p className="m-0 text-[13px] font-semibold text-[var(--admin-text-muted)]">
              No hero banners yet. Click &quot;Add slide&quot; or upload in Media Library.
            </p>
          </div>
        ) : null}
      </PremiumPanelShell>

      <HeroSlideEditorModal
        open={editor !== null}
        mode={editor?.mode ?? 'edit'}
        initial={editor?.values ?? EMPTY_SLIDE_FORM}
        saving={createBanner.isPending || updateBanner.isPending}
        onClose={() => setEditor(null)}
        onSave={handleSaveSlide}
      />
    </>
  )
}

const PANELS: Record<string, () => React.ReactNode> = {
  '/dashboard/home-page': HomePageControlPanel,
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

const CONTENT_BETA_ROUTES = new Set([
  '/dashboard/footwear-page',
  '/dashboard/theme-builder',
  '/dashboard/lookbooks',
  '/dashboard/reels',
  '/dashboard/blog',
  '/dashboard/cms',
  '/dashboard/landing-pages',
])

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
      {CONTENT_BETA_ROUTES.has(moduleHref) ? (
        <BetaBanner route={moduleHref}>
          · home / hero / legal / menu cover storefront — this route stays out of primary nav
        </BetaBanner>
      ) : null}
      {anyDown && moduleHref !== '/dashboard/footwear-page' && content.isError ? (
        <ApiOfflineBanner message="Content API offline — run pnpm dev:api on port 4000." />
      ) : null}
      {renderModuleSubPanel(Panel, props)}
    </div>
  )
}
