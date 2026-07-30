'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { DcContentNav } from '@/components/dc/DcContentNav'
import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import { DcField } from '@/components/dc/DcModal'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, toneStyle } from '@/components/dc/tokens'
import { useLegalPages, useSaveLegalPage } from '@/lib/api/hooks'
import type { LegalPageRecord } from '@/lib/api/legal-pages'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import type { LegalPageSection } from '@splaro/types'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

/** Working copy of one page, so edits are local until an explicit save. */
interface Draft {
  title: string
  description: string
  metaTitle: string
  metaDescription: string
  sections: LegalPageSection[]
}

function draftOf(page: LegalPageRecord): Draft {
  return {
    title: page.title ?? '',
    description: page.description ?? '',
    metaTitle: page.metaTitle ?? '',
    metaDescription: page.metaDescription ?? '',
    sections: (page.sections ?? []).map((s) => ({ ...s })),
  }
}

function sameDraft(a: Draft, b: Draft): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function DcLegalPages() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="legal" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcLegalPagesBody />
    </DcScreenProvider>
  )
}

function DcLegalPagesBody() {
  const { toast } = useDcScreen()
  const pages = useLegalPages()
  const save = useSaveLegalPage()
  const { api } = useAdminConnection(25_000)

  const [slug, setSlug] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)

  const rows = useMemo(() => pages.data ?? [], [pages.data])
  const selected = useMemo(
    () => rows.find((p) => p.slug === slug) ?? rows[0] ?? null,
    [rows, slug],
  )

  // Load the working copy whenever the selected page changes or is refetched.
  useEffect(() => {
    if (selected) setDraft(draftOf(selected))
  }, [selected])

  const baseline = selected ? draftOf(selected) : null
  const dirty = !!draft && !!baseline && !sameDraft(draft, baseline)

  const pageStatus = dcPageStatus([pages], api.pulse)

  const patch = (next: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...next } : d))

  const moveSection = (index: number, direction: -1 | 1) => {
    setDraft((d) => {
      if (!d) return d
      const target = index + direction
      if (target < 0 || target >= d.sections.length) return d
      const sections = [...d.sections]
      const held = sections[index]!
      sections[index] = sections[target]!
      sections[target] = held
      return { ...d, sections }
    })
  }

  const removeSection = (index: number) =>
    setDraft((d) => (d ? { ...d, sections: d.sections.filter((_, i) => i !== index) } : d))

  const addSection = () =>
    setDraft((d) =>
      d ? { ...d, sections: [...d.sections, { heading: 'New section', body: '' }] } : d,
    )

  const runSave = () => {
    if (!selected || !draft) return
    save.mutate(
      {
        slug: selected.slug,
        body: {
          title: draft.title.trim(),
          description: draft.description.trim(),
          sections: draft.sections,
          ...(draft.metaTitle.trim() ? { metaTitle: draft.metaTitle.trim() } : {}),
          ...(draft.metaDescription.trim()
            ? { metaDescription: draft.metaDescription.trim() }
            : {}),
        },
      },
      {
        onSuccess: () =>
          toast('ok', 'Saved and verified', `${selected.label} is live on the storefront.`),
        onError: (err) =>
          toast(
            'bad',
            'Could not save the page',
            err instanceof Error
              ? err.message
              : `PUT /admin/content/legal-pages/${selected.slug} failed`,
          ),
      },
    )
  }

  const skeleton: DcBlock[] = [
    { t: 'tabs', group: 'nav', items: [] } as DcBlock,
    { t: 'list', w: 'side', title: '', items: [] } as DcBlock,
    { t: 'form', w: 'main', title: '', fields: [] } as DcBlock,
  ]

  return (
    <>
      <DcPageHead
        crumbGroup="Content"
        title="Legal Pages"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          pages.isFetching
            ? 'syncing…'
            : selected?.updatedAt
              ? `${selected.label} · updated ${new Date(selected.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
              : `${rows.length} page${rows.length === 1 ? '' : 's'}`
        }
        syncing={pages.isFetching}
        onSync={() => void pages.refetch()}
        actions={
          selected
            ? [
                {
                  label: 'Preview',
                  icon: 'icon-external-link',
                  onClick: () => window.open(selected.path, '_blank', 'noopener'),
                },
              ]
            : []
        }
      />

      <DcContentNav active="legal" />

      {pages.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : pages.error ? (
        <DcErrorState
          error={`GET /admin/content/legal-pages → ${pages.error instanceof Error ? pages.error.message : '500 Internal Server Error'}`}
          hint="Pages already published are unaffected — only this editor failed to load."
          onRetry={() => void pages.refetch()}
        />
      ) : !selected || !draft ? (
        <DcErrorState
          error="GET /admin/content/legal-pages → 200 with an empty list"
          hint="The API returned no pages at all, which should not happen — the catalog is seeded from LEGAL_PAGE_CATALOG."
          onRetry={() => void pages.refetch()}
        />
      ) : (
        <>
          {dirty ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                padding: '12px 15px',
                border: '1px solid var(--warn-bd)',
                borderRadius: 12,
                background: 'var(--warn-soft)',
              }}
            >
              <DcIcon name="icon-pencil" size={15} color="var(--warn)" />
              <span
                style={{
                  flex: 1,
                  minWidth: 170,
                  font: `500 12.5px/1.5 ${FONT}`,
                  color: 'var(--ink-2)',
                  textWrap: 'pretty',
                }}
              >
                Unsaved text changes on {selected.label}. Nothing reaches the storefront until you
                save.
              </span>
              <button
                type="button"
                onClick={() => setDraft(draftOf(selected))}
                className="dc-hover-ink"
                style={{
                  height: 32,
                  padding: '0 13px',
                  borderRadius: 9,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  color: 'var(--ink-2)',
                  cursor: 'pointer',
                  font: `600 12.5px/1 ${FONT}`,
                }}
              >
                Reset
              </button>
              <button
                type="button"
                disabled={save.isPending}
                onClick={runSave}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  height: 32,
                  padding: '0 14px',
                  borderRadius: 9,
                  border: '1px solid var(--violet-solid)',
                  background: 'var(--violet-solid)',
                  color: 'var(--on-violet)',
                  cursor: save.isPending ? 'not-allowed' : 'pointer',
                  font: `600 12.5px/1 ${FONT}`,
                  opacity: save.isPending ? 0.7 : 1,
                }}
              >
                <DcIcon name="icon-check" size={13} />
                <span>{save.isPending ? 'Saving…' : 'Save changes'}</span>
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 15px',
                border: '1px solid var(--line)',
                borderRadius: 12,
                background: 'var(--surface)',
              }}
            >
              <DcIcon name="icon-circle-check" size={15} color="var(--ok)" />
              <span style={{ flex: 1, font: `500 12.5px/1.5 ${FONT}`, color: 'var(--ink-2)' }}>
                No unsaved changes.{' '}
                {selected.isCustomized
                  ? 'This page has been edited from the shipped default.'
                  : 'This page is still the shipped default.'}
              </span>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              alignItems: 'flex-start',
              width: '100%',
            }}
          >
            <div
              style={{
                flex: '1 1 56%',
                minWidth: 340,
                maxWidth: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div
                style={{
                  ...card,
                  padding: '15px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 13,
                }}
              >
                <span style={{ font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                  {selected.label}
                </span>
                <DcField
                  label="Page title"
                  value={draft.title}
                  onChange={(v) => patch({ title: v })}
                />
                <DcField
                  label="Description"
                  value={draft.description}
                  onChange={(v) => patch({ description: v })}
                  area
                />
                <DcField
                  label="Meta title"
                  value={draft.metaTitle}
                  onChange={(v) => patch({ metaTitle: v })}
                  hint="Left empty, the page title is used."
                />
                <DcField
                  label="Meta description"
                  value={draft.metaDescription}
                  onChange={(v) => patch({ metaDescription: v })}
                  area
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span
                    style={{
                      font: `600 11px/1 ${FONT}`,
                      letterSpacing: '.07em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-3)',
                    }}
                  >
                    URL
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      minHeight: 40,
                      padding: '10px 12px',
                      borderRadius: 9,
                      border: '1px solid var(--line)',
                      background: 'var(--surface-2)',
                    }}
                  >
                    <span style={{ flex: 1, font: `400 12.5px/1.55 ${MONO}`, color: 'var(--ink)' }}>
                      {selected.path}
                    </span>
                    <DcIcon name="icon-lock" size={12} color="var(--ink-3)" />
                  </div>
                  <span style={{ font: `400 11.5px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
                    The path is fixed by the slug — changing it would break every existing link.
                  </span>
                </div>
              </div>

              <div style={{ ...card, padding: '6px 16px 12px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                    padding: '12px 0 10px',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 150,
                      font: `600 13.5px/1.3 ${FONT}`,
                      color: 'var(--ink)',
                    }}
                  >
                    Sections
                  </span>
                  <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                    {draft.sections.length} on the page
                  </span>
                </div>
                <div
                  style={{
                    font: `400 12px/1.55 ${FONT}`,
                    color: 'var(--ink-3)',
                    paddingBottom: 10,
                    textWrap: 'pretty',
                  }}
                >
                  Reorder with the arrows. Remove takes the section off the page — nothing is
                  written until you save.
                </div>

                {draft.sections.length === 0 ? (
                  <div
                    style={{
                      padding: '30px 0',
                      textAlign: 'center',
                      font: `400 12.5px/1.55 ${FONT}`,
                      color: 'var(--ink-3)',
                      borderTop: '1px solid var(--line)',
                    }}
                  >
                    This page has no sections. Add one to give it a body.
                  </div>
                ) : (
                  draft.sections.map((section, i) => (
                    <div
                      key={`${i}-${section.heading}`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 9,
                        padding: '12px 0',
                        borderTop: '1px solid var(--line)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 9,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            display: 'grid',
                            placeItems: 'center',
                            width: 26,
                            height: 26,
                            flex: 'none',
                            borderRadius: 8,
                            border: '1px solid var(--line)',
                            background: 'var(--surface-2)',
                            font: `600 11px/1 ${MONO}`,
                            color: 'var(--ink-3)',
                          }}
                        >
                          {i + 1}
                        </span>
                        <input
                          value={section.heading}
                          onChange={(e) =>
                            patch({
                              sections: draft.sections.map((s, idx) =>
                                idx === i ? { ...s, heading: e.target.value } : s,
                              ),
                            })
                          }
                          placeholder="Section heading"
                          style={{
                            flex: 1,
                            minWidth: 160,
                            height: 34,
                            padding: '0 11px',
                            borderRadius: 9,
                            border: '1px solid var(--line)',
                            background: 'var(--surface-2)',
                            outline: 'none',
                            color: 'var(--ink)',
                            font: `500 12.5px/1 ${FONT}`,
                          }}
                        />
                        <span
                          style={{
                            flex: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            height: 24,
                            padding: '0 9px',
                            borderRadius: 6,
                            font: `600 10.5px/1 ${FONT}`,
                            letterSpacing: '.05em',
                            border: `1px solid ${toneStyle('mute').bd}`,
                            background: toneStyle('mute').bg,
                            color: toneStyle('mute').fg,
                          }}
                        >
                          SECTION
                        </span>
                        <IconBtn
                          icon="icon-chevron-up"
                          title="Move up"
                          onClick={() => moveSection(i, -1)}
                        />
                        <IconBtn
                          icon="icon-chevron-down"
                          title="Move down"
                          onClick={() => moveSection(i, 1)}
                        />
                        <button
                          type="button"
                          onClick={() => removeSection(i)}
                          style={{
                            height: 30,
                            padding: '0 12px',
                            borderRadius: 8,
                            border: '1px solid var(--line)',
                            background: 'var(--surface-2)',
                            color: 'var(--ink-2)',
                            cursor: 'pointer',
                            font: `600 12px/1 ${FONT}`,
                          }}
                        >
                          Remove
                        </button>
                      </div>
                      <textarea
                        rows={3}
                        value={section.body}
                        onChange={(e) =>
                          patch({
                            sections: draft.sections.map((s, idx) =>
                              idx === i ? { ...s, body: e.target.value } : s,
                            ),
                          })
                        }
                        placeholder="Section text"
                        style={{
                          padding: '10px 12px',
                          borderRadius: 9,
                          border: '1px solid var(--line)',
                          background: 'var(--surface-2)',
                          outline: 'none',
                          resize: 'vertical',
                          color: 'var(--ink)',
                          font: `400 12.5px/1.55 ${FONT}`,
                        }}
                      />
                    </div>
                  ))
                )}

                <div style={{ paddingTop: 12, borderTop: '1px solid var(--line)', marginTop: 2 }}>
                  <button
                    type="button"
                    onClick={addSection}
                    className="dc-hover-violet"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      height: 31,
                      padding: '0 12px',
                      borderRadius: 8,
                      border: '1px dashed var(--line-2)',
                      background: 'transparent',
                      color: 'var(--ink-2)',
                      cursor: 'pointer',
                      font: `600 12px/1 ${FONT}`,
                    }}
                  >
                    <DcIcon name="icon-plus" size={13} />
                    <span>Add section</span>
                  </button>
                </div>
              </div>
            </div>

            <div style={{ flex: '1 1 28%', minWidth: 290, maxWidth: '100%' }}>
              <div style={{ ...card, padding: '6px 16px 8px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 0 8px',
                  }}
                >
                  <span style={{ flex: 1, font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                    Legal pages
                  </span>
                  <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                    always editable · no publish flag
                  </span>
                </div>
                {rows.map((p) => {
                  const on = p.slug === selected.slug
                  return (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => {
                        if (dirty) {
                          toast(
                            'warn',
                            'Unsaved changes',
                            'Save or reset this page before switching to another one.',
                          )
                          return
                        }
                        setSlug(p.slug)
                      }}
                      className={on ? undefined : 'dc-hover-surface'}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 11,
                        width: '100%',
                        padding: '10px 0',
                        border: 0,
                        borderTop: '1px solid var(--line)',
                        background: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span
                        style={{
                          display: 'grid',
                          placeItems: 'center',
                          width: 28,
                          height: 28,
                          flex: 'none',
                          borderRadius: 8,
                          border: '1px solid var(--line)',
                          background: 'var(--surface-2)',
                          color: on ? 'var(--violet)' : 'var(--ink-3)',
                        }}
                      >
                        <DcIcon name="icon-scale" size={13} />
                      </span>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        <span
                          style={{
                            font: `500 12.5px/1.3 ${FONT}`,
                            color: on ? 'var(--violet)' : 'var(--ink)',
                          }}
                        >
                          {p.label}
                        </span>
                        <span
                          style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}
                        >
                          {p.updatedAt
                            ? `updated ${new Date(p.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
                            : 'never edited'}
                        </span>
                      </span>
                      <span
                        style={{
                          flex: 'none',
                          font: `600 10.5px/1 ${FONT}`,
                          letterSpacing: '.05em',
                          color: on ? 'var(--violet)' : 'var(--ink-3)',
                        }}
                      >
                        {on ? 'EDITING' : p.isCustomized ? 'EDITED' : 'DEFAULT'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function IconBtn({
  icon,
  title,
  onClick,
}: {
  icon: string
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="dc-hover-ink"
      style={{
        display: 'grid',
        placeItems: 'center',
        width: 30,
        height: 30,
        flex: 'none',
        borderRadius: 8,
        border: '1px solid var(--line)',
        background: 'var(--surface-2)',
        color: 'var(--ink-3)',
        cursor: 'pointer',
      }}
    >
      <DcIcon name={icon} size={13} />
    </button>
  )
}
