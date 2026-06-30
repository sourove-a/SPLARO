'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import { toastApiSaved, toastFail } from '@/lib/admin/feedback'
import { useLegalPage, useLegalPages, useSaveLegalPage } from '@/lib/api/hooks'
import { DEFAULT_LEGAL_PAGES, LEGAL_PAGE_CATALOG, type LegalPageContent, type LegalPageSlug } from '@splaro/types'
import { cn } from '@/lib/utils/cn'

function newSectionId() {
  return `sec-${Date.now().toString(36)}`
}

type DraftSection = { id: string; heading: string; body: string }

function toDraft(content: LegalPageContent): {
  title: string
  description: string
  metaTitle: string
  metaDescription: string
  sections: DraftSection[]
} {
  return {
    title: content.title,
    description: content.description,
    metaTitle: content.metaTitle ?? content.title,
    metaDescription: content.metaDescription ?? content.description,
    sections: content.sections.map((section) => ({
      id: newSectionId(),
      heading: section.heading,
      body: section.body,
    })),
  }
}

export function LegalPagesPanel() {
  const searchParams = useSearchParams()
  const slugFromQuery = searchParams.get('slug')
  const { data: pages, isError, isLoading, refetch } = useLegalPages()
  const [activeSlug, setActiveSlug] = useState<LegalPageSlug>('terms')
  const { data: page, isLoading: pageLoading } = useLegalPage(activeSlug)
  const saveMutation = useSaveLegalPage()
  const [draft, setDraft] = useState<ReturnType<typeof toDraft> | null>(null)

  const activeMeta = useMemo(
    () => LEGAL_PAGE_CATALOG.find((item) => item.slug === activeSlug),
    [activeSlug],
  )

  useEffect(() => {
    if (slugFromQuery && (LEGAL_PAGE_CATALOG.some((item) => item.slug === slugFromQuery))) {
      setActiveSlug(slugFromQuery as LegalPageSlug)
    }
  }, [slugFromQuery])

  useEffect(() => {
    if (page) setDraft(toDraft(page))
  }, [page, activeSlug])

  if (isError) return <ApiOfflineBanner message="Legal pages API offline — run pnpm dev:api on port 4000." />

  const resetToDefault = () => {
    const fallback = DEFAULT_LEGAL_PAGES[activeSlug]
    setDraft(toDraft(fallback))
  }

  const save = async () => {
    if (!draft) return

    try {
      const payload: LegalPageContent = {
        title: draft.title.trim(),
        description: draft.description.trim(),
        metaTitle: draft.metaTitle.trim() || draft.title.trim(),
        metaDescription: draft.metaDescription.trim() || draft.description.trim(),
        sections: draft.sections.map((section) => ({
          heading: section.heading.trim(),
          body: section.body.trim(),
        })),
      }

      const saved = await saveMutation.mutateAsync({ slug: activeSlug, body: payload })
      if (saved.title !== payload.title || saved.sections.length !== payload.sections.length) {
        toastFail('Save failed verification — please retry.')
        return
      }
      toastApiSaved(activeMeta?.label ?? 'Legal page')
    } catch (error) {
      toastFail(error instanceof Error ? error.message : 'Could not save legal page.')
    }
  }

  const updateSection = (id: string, patch: Partial<DraftSection>) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            sections: prev.sections.map((section) => (section.id === id ? { ...section, ...patch } : section)),
          }
        : prev,
    )
  }

  const moveSection = (index: number, direction: -1 | 1) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = [...prev.sections]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      const current = next[index]
      const swap = next[target]
      if (!current || !swap) return prev
      next[index] = swap
      next[target] = current
      return { ...prev, sections: next }
    })
  }

  const addSection = () => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            sections: [...prev.sections, { id: newSectionId(), heading: 'New section', body: '' }],
          }
        : prev,
    )
  }

  const removeSection = (id: string) => {
    setDraft((prev) => {
      if (!prev || prev.sections.length <= 1) {
        toastFail('Keep at least one section.')
        return prev
      }
      return { ...prev, sections: prev.sections.filter((section) => section.id !== id) }
    })
  }

  return (
    <div className="space-y-4">
      <section className="product-create-hero">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--admin-text-secondary)]">
            SPLARO · Content
          </p>
          <h2 className="mt-1 text-2xl font-black text-[var(--admin-text)]">Legal & policy pages</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-[var(--admin-text-secondary)]">
            Edit Terms & Conditions, Privacy Policy, Shipping, Returns, and every storefront policy page. Changes go live on the website after save.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminButton variant="ghost" onClick={() => void refetch()}>
            Refresh
          </AdminButton>
          {activeMeta ? (
            <AdminNavLink href={`http://localhost:3000${activeMeta.path}`} className="admin-btn admin-btn--ghost">
              <Eye className="h-4 w-4" />
              Preview
            </AdminNavLink>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="product-create-section !p-0 overflow-hidden">
          <div className="border-b border-[var(--admin-glass-border-subtle)] px-4 py-3">
            <p className="admin-kpi__label">Pages</p>
            <p className="text-xs font-semibold text-[var(--admin-text-muted)]">
              {isLoading ? 'Loading…' : `${pages?.length ?? 0} editable routes`}
            </p>
          </div>
          <div className="max-h-[640px] overflow-y-auto p-2">
            {LEGAL_PAGE_CATALOG.map((item) => {
              const row = pages?.find((pageRow) => pageRow.slug === item.slug)
              const active = activeSlug === item.slug
              return (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => setActiveSlug(item.slug)}
                  className={cn(
                    'mb-1 flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition',
                    active
                      ? 'border-[var(--admin-accent-border)] bg-[var(--admin-accent-muted)]'
                      : 'border-transparent hover:border-[var(--admin-glass-border-subtle)] hover:bg-[var(--admin-surface-hover)]',
                  )}
                >
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-accent)]" />
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-[var(--admin-text)]">{item.label}</span>
                    <span className="block font-mono text-[10px] text-[var(--admin-text-muted)]">{item.path}</span>
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-[var(--admin-text-secondary)]">
                      {row?.isCustomized ? 'Custom saved' : 'Default copy'}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="space-y-4">
          {pageLoading || !draft ? (
            <div className="product-create-section flex items-center gap-2 text-sm font-semibold text-[var(--admin-text-secondary)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading page editor…
            </div>
          ) : (
            <>
              <section className="product-create-section space-y-4">
                <header className="product-create-section__head !mb-0">
                  <h4 className="product-create-section__title">{activeMeta?.label ?? 'Legal page'}</h4>
                  <p className="product-create-section__hint">
                    {page?.isCustomized ? 'Using your saved version on the storefront.' : 'Showing SPLARO default copy until you save changes.'}
                  </p>
                </header>

                <label className="admin-field block space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wide text-[var(--admin-text-secondary)]">Page title</span>
                  <input
                    className="admin-input admin-input--premium"
                    value={draft.title}
                    onChange={(event) => setDraft((prev) => (prev ? { ...prev, title: event.target.value } : prev))}
                  />
                </label>

                <label className="admin-field block space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wide text-[var(--admin-text-secondary)]">Intro / summary</span>
                  <textarea
                    className="admin-input admin-input--premium min-h-[88px] resize-y"
                    value={draft.description}
                    onChange={(event) => setDraft((prev) => (prev ? { ...prev, description: event.target.value } : prev))}
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="admin-field block space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-wide text-[var(--admin-text-secondary)]">SEO title</span>
                    <input
                      className="admin-input admin-input--premium"
                      value={draft.metaTitle}
                      onChange={(event) => setDraft((prev) => (prev ? { ...prev, metaTitle: event.target.value } : prev))}
                    />
                  </label>
                  <label className="admin-field block space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-wide text-[var(--admin-text-secondary)]">SEO description</span>
                    <input
                      className="admin-input admin-input--premium"
                      value={draft.metaDescription}
                      onChange={(event) => setDraft((prev) => (prev ? { ...prev, metaDescription: event.target.value } : prev))}
                    />
                  </label>
                </div>
              </section>

              <section className="product-create-section space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="product-create-section__title">Sections</h4>
                    <p className="product-create-section__hint">Each heading becomes an H2 on the live page.</p>
                  </div>
                  <AdminButton variant="ghost" onClick={addSection}>
                    <Plus className="h-4 w-4" />
                    Add section
                  </AdminButton>
                </div>

                {draft.sections.map((section, index) => (
                  <div key={section.id} className="rounded-2xl border border-[var(--admin-glass-border-subtle)] bg-[var(--admin-glass-soft)] p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-black uppercase tracking-wide text-[var(--admin-text-secondary)]">
                        Section {index + 1}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <button type="button" className="admin-btn admin-btn--ghost !px-2 !py-1" onClick={() => moveSection(index, -1)} disabled={index === 0}>
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost !px-2 !py-1"
                          onClick={() => moveSection(index, 1)}
                          disabled={index === draft.sections.length - 1}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button type="button" className="admin-btn admin-btn--ghost !px-2 !py-1" onClick={() => removeSection(section.id)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <label className="admin-field mb-3 block space-y-1.5">
                      <span className="text-xs font-bold text-[var(--admin-text-secondary)]">Heading</span>
                      <input
                        className="admin-input admin-input--premium"
                        value={section.heading}
                        onChange={(event) => updateSection(section.id, { heading: event.target.value })}
                      />
                    </label>

                    <label className="admin-field block space-y-1.5">
                      <span className="text-xs font-bold text-[var(--admin-text-secondary)]">Body</span>
                      <textarea
                        className="admin-input admin-input--premium min-h-[120px] resize-y"
                        value={section.body}
                        onChange={(event) => updateSection(section.id, { body: event.target.value })}
                      />
                    </label>
                  </div>
                ))}
              </section>

              <div className="flex flex-wrap gap-2">
                <AdminButton variant="gold" onClick={() => void save()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save to storefront
                </AdminButton>
                <AdminButton variant="ghost" onClick={resetToDefault}>
                  <RotateCcw className="h-4 w-4" />
                  Reset to default
                </AdminButton>
                {activeMeta ? (
                  <a
                    href={`http://localhost:3000${activeMeta.path}`}
                    target="_blank"
                    rel="noreferrer"
                    className="admin-btn admin-btn--ghost"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open live page
                  </a>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
