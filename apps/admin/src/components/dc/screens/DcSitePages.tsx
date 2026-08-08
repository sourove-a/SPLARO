'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState, type CSSProperties } from 'react'
import { LEGAL_PAGE_SLUGS } from '@splaro/types'

import { DcContentNav } from '@/components/dc/DcContentNav'
import { DcField, DcModal } from '@/components/dc/DcModal'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, toneStyle } from '@/components/dc/tokens'
import {
  verifyBannerDeleteSuccess,
  verifyBooleanEquals,
  verifyStringEquals,
} from '@/lib/admin/mutation-verify'
import {
  createSitePage,
  deleteSitePage,
  fetchAllSitePages,
  fetchLandingPages,
  updateSitePage,
  type SitePageRow,
} from '@/lib/api/content-pages'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { getStorefrontOrigin } from '@/lib/storefront-origin'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const LEGAL = new Set<string>(LEGAL_PAGE_SLUGS)

type Mode = 'landing' | 'cms'

interface FormState {
  title: string
  content: string
  metaTitle: string
  metaDesc: string
  isPublished: boolean
}

const EMPTY: FormState = {
  title: '',
  content: '',
  metaTitle: '',
  metaDesc: '',
  isPublished: false,
}

function SitePagesScreen({
  mode,
  screen,
  navActive,
  title,
  crumbHint,
}: {
  mode: Mode
  screen: string
  navActive: string
  title: string
  crumbHint: string
}) {
  const router = useRouter()
  return (
    <DcScreenProvider screen={screen} onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <SitePagesBody
        mode={mode}
        navActive={navActive}
        title={title}
        crumbHint={crumbHint}
      />
    </DcScreenProvider>
  )
}

function SitePagesBody({
  mode,
  navActive,
  title,
  crumbHint,
}: {
  mode: Mode
  navActive: string
  title: string
  crumbHint: string
}) {
  const { toast } = useDcScreen()
  const qc = useQueryClient()
  const { api } = useAdminConnection(25_000)
  const queryKey = mode === 'landing' ? ['site-pages', 'landing'] : ['site-pages', 'cms']

  const pages = useQuery({
    queryKey,
    queryFn: mode === 'landing' ? fetchLandingPages : fetchAllSitePages,
    staleTime: 30_000,
    retry: 1,
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['site-pages'] })
  }

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SitePageRow | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [confirmDelete, setConfirmDelete] = useState<SitePageRow | null>(null)
  const [busy, setBusy] = useState(false)

  const rows = useMemo(() => {
    const all = pages.data ?? []
    if (mode === 'landing') return all
    return all.filter((p) => !LEGAL.has(p.slug) && !p.isHomepage)
  }, [pages.data, mode])

  const published = rows.filter((p) => p.isPublished)
  const drafts = rows.filter((p) => !p.isPublished)

  const pageStatus = dcPageStatus([pages], api.pulse)
  const skeleton: DcBlock[] = [{ t: 'kpis' } as DcBlock, { t: 'table', w: 'full', title: '', cols: [], rows: [] } as DcBlock]

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setFormOpen(true)
  }

  const openEdit = (row: SitePageRow) => {
    setEditing(row)
    setForm({
      title: row.title,
      content: row.content ?? '',
      metaTitle: row.metaTitle ?? '',
      metaDesc: row.metaDesc ?? '',
      isPublished: row.isPublished,
    })
    setFormOpen(true)
  }

  const runSave = async () => {
    const titleTrim = form.title.trim()
    if (!titleTrim) {
      toast('warn', 'Title required', 'Every page needs a title before it can be saved.')
      return
    }
    setBusy(true)
    try {
      if (editing) {
        const saved = await updateSitePage(editing.id, {
          title: titleTrim,
          content: form.content,
          metaTitle: form.metaTitle.trim() || titleTrim,
          metaDesc: form.metaDesc.trim(),
          isPublished: form.isPublished,
        })
        if (!verifyStringEquals(saved.title, titleTrim, 'Page title')) return
        if (!verifyBooleanEquals(saved.isPublished, form.isPublished, 'Publish state')) return
        setFormOpen(false)
        invalidate()
        toast('ok', `${saved.title} saved`, 'Server confirmed the page fields.')
      } else {
        const created = await createSitePage({
          title: titleTrim,
          ...(form.content.trim() ? { content: form.content } : {}),
          metaTitle: form.metaTitle.trim() || titleTrim,
          ...(form.metaDesc.trim() ? { metaDesc: form.metaDesc.trim() } : {}),
          isPublished: form.isPublished,
        })
        if (!verifyStringEquals(created.title, titleTrim, 'Page title')) return
        setFormOpen(false)
        invalidate()
        toast(
          'ok',
          `${created.title} created`,
          created.isPublished
            ? 'Published on the storefront.'
            : 'Saved as draft — publish when ready.',
        )
      }
    } catch (err) {
      toast('bad', 'Save failed', err instanceof Error ? err.message : 'Check API connection')
    } finally {
      setBusy(false)
    }
  }

  const runTogglePublish = async (row: SitePageRow) => {
    const next = !row.isPublished
    setBusy(true)
    try {
      const saved = await updateSitePage(row.id, { isPublished: next })
      if (!verifyBooleanEquals(saved.isPublished, next, 'Publish state')) return
      invalidate()
      toast('ok', next ? `${row.title} published` : `${row.title} unpublished`, 'Server confirmed.')
    } catch (err) {
      toast('bad', 'Publish failed', err instanceof Error ? err.message : 'Check API connection')
    } finally {
      setBusy(false)
    }
  }

  const runDelete = async () => {
    if (!confirmDelete) return
    setBusy(true)
    try {
      const res = await deleteSitePage(confirmDelete.id)
      if (!verifyBannerDeleteSuccess(res)) return
      setConfirmDelete(null)
      invalidate()
      toast('ok', `${confirmDelete.title} deleted`, 'Removed from the content API.')
    } catch (err) {
      toast('bad', 'Delete failed', err instanceof Error ? err.message : 'Check API connection')
    } finally {
      setBusy(false)
    }
  }

  const origin = getStorefrontOrigin()

  return (
    <>
      <DcPageHead
        crumbGroup="Content"
        title={title}
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          pages.isFetching
            ? 'syncing…'
            : `${rows.length} page${rows.length === 1 ? '' : 's'}`
        }
        syncing={pages.isFetching}
        onSync={() => void pages.refetch()}
        actions={[
          {
            label: 'New page',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: openCreate,
          },
        ]}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 0 32px' }}>
        <DcContentNav active={navActive} />

        <p style={{ margin: 0, font: `400 13px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>{crumbHint}</p>

        {pages.isLoading ? (
          <DcLoadingState blocks={skeleton} />
        ) : pages.isError ? (
          <DcErrorState
            error={`GET /admin/content/pages → ${pages.error instanceof Error ? pages.error.message : 'API error'}`}
            hint="Pages already saved are unaffected — only this list failed to load."
            onRetry={() => void pages.refetch()}
          />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
              {[
                { label: 'Total', value: String(rows.length) },
                { label: 'Published', value: String(published.length) },
                { label: 'Drafts', value: String(drafts.length) },
              ].map((k) => (
                <div key={k.label} style={{ ...card, padding: '14px 16px' }}>
                  <div style={{ font: `600 11px/1 ${FONT}`, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                    {k.label}
                  </div>
                  <div style={{ marginTop: 8, font: `700 22px/1 ${MONO}`, color: 'var(--ink)' }}>{k.value}</div>
                </div>
              ))}
            </div>

            {rows.length === 0 ? (
              <DcEmptyState
                icon="icon-file-text"
                title={mode === 'landing' ? 'No landing pages yet' : 'No CMS pages yet'}
                body="Create a page — it starts as draft until you publish."
                cta="New page"
                onCta={openCreate}
              />
            ) : (
              <div style={{ ...card, overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      {['Title', 'Slug', 'Status', 'Updated', ''].map((h) => (
                        <th
                          key={h || 'actions'}
                          style={{
                            textAlign: 'left',
                            padding: '12px 14px',
                            font: `600 11px/1 ${FONT}`,
                            letterSpacing: '.08em',
                            textTransform: 'uppercase',
                            color: 'var(--ink-3)',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '12px 14px', font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                          {row.title}
                        </td>
                        <td style={{ padding: '12px 14px', font: `500 12px/1 ${MONO}`, color: 'var(--ink-2)' }}>
                          /{row.slug}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{
                              ...toneStyle(row.isPublished ? 'ok' : 'warn'),
                              display: 'inline-flex',
                              padding: '3px 8px',
                              borderRadius: 999,
                              font: `600 11px/1 ${FONT}`,
                            }}
                          >
                            {row.isPublished ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', font: `500 12px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                          {new Date(row.updatedAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            style={linkBtn}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void runTogglePublish(row)}
                            style={linkBtn}
                          >
                            {row.isPublished ? 'Unpublish' : 'Publish'}
                          </button>
                          {row.isPublished ? (
                            <a
                              href={`${origin}/lp/${row.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ ...linkBtn, textDecoration: 'none' }}
                            >
                              View
                            </a>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(row)}
                            style={{ ...linkBtn, color: 'var(--bad)' }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <DcModal
        open={formOpen}
        title={editing ? 'Edit page' : 'New page'}
        subtitle="Title and body save to the content API. Publish only when the page should be live."
        confirmLabel={busy ? 'Saving…' : 'Save'}
        busy={busy}
        onClose={() => !busy && setFormOpen(false)}
        onConfirm={() => void runSave()}
      >
        <DcField
          label="Title"
          value={form.title}
          onChange={(v) => setForm((f) => ({ ...f, title: v }))}
          placeholder="Summer sale landing"
        />
        <DcField
          label="Body / content"
          value={form.content}
          onChange={(v) => setForm((f) => ({ ...f, content: v }))}
          placeholder="Page copy (HTML or plain text)"
          area
        />
        <DcField
          label="Meta title"
          value={form.metaTitle}
          onChange={(v) => setForm((f) => ({ ...f, metaTitle: v }))}
        />
        <DcField
          label="Meta description"
          value={form.metaDesc}
          onChange={(v) => setForm((f) => ({ ...f, metaDesc: v }))}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, font: `500 13px/1 ${FONT}`, color: 'var(--ink-2)' }}>
          <input
            type="checkbox"
            checked={form.isPublished}
            onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
          />
          Published
        </label>
      </DcModal>

      <DcModal
        open={Boolean(confirmDelete)}
        title="Delete page?"
        subtitle={confirmDelete ? `Permanently remove “${confirmDelete.title}”.` : undefined}
        confirmLabel="Delete"
        danger
        busy={busy}
        onClose={() => !busy && setConfirmDelete(null)}
        onConfirm={() => void runDelete()}
      />
    </>
  )
}

const linkBtn: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '0 8px 0 0',
  cursor: 'pointer',
  font: `600 12px/1 ${FONT}`,
  color: 'var(--violet-solid)',
}

export function DcLandingPages() {
  return (
    <SitePagesScreen
      mode="landing"
      screen="landing"
      navActive="landing"
      title="Landing Pages"
      crumbHint="Campaign landing pages. Unpublished pages stay off the storefront until you publish."
    />
  )
}

export function DcCmsPages() {
  return (
    <SitePagesScreen
      mode="cms"
      screen="cms"
      navActive="cms"
      title="CMS Pages"
      crumbHint="Site pages excluding legal policies (those live under Legal Pages). Create, edit, publish, delete."
    />
  )
}
