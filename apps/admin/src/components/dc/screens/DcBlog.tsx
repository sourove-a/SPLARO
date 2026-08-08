'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState, type CSSProperties } from 'react'

import { DcContentNav } from '@/components/dc/DcContentNav'
import { DcField, DcModal } from '@/components/dc/DcModal'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, toneStyle } from '@/components/dc/tokens'
import { verifyBannerDeleteSuccess, verifyStringEquals } from '@/lib/admin/mutation-verify'
import {
  createBlogPost,
  deleteBlogPost,
  fetchBlogPosts,
  updateBlogPost,
  type BlogPostRow,
} from '@/lib/api/blog'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

interface FormState {
  title: string
  excerpt: string
  content: string
  featuredImage: string
  status: 'DRAFT' | 'PUBLISHED'
}

const EMPTY: FormState = {
  title: '',
  excerpt: '',
  content: '',
  featuredImage: '',
  status: 'DRAFT',
}

export function DcBlog() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="blog" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcBlogBody />
    </DcScreenProvider>
  )
}

function DcBlogBody() {
  const { toast } = useDcScreen()
  const qc = useQueryClient()
  const { api } = useAdminConnection(25_000)

  const posts = useQuery({
    queryKey: ['blog-posts'],
    queryFn: () => fetchBlogPosts({ limit: 100 }),
    staleTime: 30_000,
    retry: 1,
  })

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['blog-posts'] })

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<BlogPostRow | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [confirmDelete, setConfirmDelete] = useState<BlogPostRow | null>(null)
  const [busy, setBusy] = useState(false)

  const rows = useMemo(() => posts.data?.posts ?? [], [posts.data])
  const published = rows.filter((p) => p.status === 'PUBLISHED')
  const drafts = rows.filter((p) => p.status !== 'PUBLISHED')

  const pageStatus = dcPageStatus([posts], api.pulse)
  const skeleton: DcBlock[] = [{ t: 'kpis' } as DcBlock, { t: 'table', w: 'full', title: '', cols: [], rows: [] } as DcBlock]

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setFormOpen(true)
  }

  const openEdit = (row: BlogPostRow) => {
    setEditing(row)
    setForm({
      title: row.title,
      excerpt: row.excerpt ?? '',
      content: row.content ?? '',
      featuredImage: row.featuredImage ?? '',
      status: row.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
    })
    setFormOpen(true)
  }

  const runSave = async () => {
    const title = form.title.trim()
    if (!title) {
      toast('warn', 'Title required', 'A blog post needs a title.')
      return
    }
    setBusy(true)
    try {
      if (editing) {
        const patch: Parameters<typeof updateBlogPost>[1] = {
          title,
          excerpt: form.excerpt.trim(),
          content: form.content,
          status: form.status,
        }
        const featured = form.featuredImage.trim()
        if (featured) patch.featuredImage = featured
        const saved = await updateBlogPost(editing.id, patch)
        if (!verifyStringEquals(saved.title, title, 'Post title')) return
        if (!verifyStringEquals(saved.status, form.status, 'Post status')) return
        setFormOpen(false)
        invalidate()
        toast('ok', `${saved.title} saved`, 'Blog post confirmed on the content API.')
      } else {
        const payload: Parameters<typeof createBlogPost>[0] = {
          title,
          content: form.content || '',
          status: form.status,
        }
        const excerpt = form.excerpt.trim()
        const featured = form.featuredImage.trim()
        if (excerpt) payload.excerpt = excerpt
        if (featured) payload.featuredImage = featured
        const created = await createBlogPost(payload)
        if (!verifyStringEquals(created.title, title, 'Post title')) return
        setFormOpen(false)
        invalidate()
        toast(
          'ok',
          `${created.title} created`,
          created.status === 'PUBLISHED' ? 'Published.' : 'Saved as draft.',
        )
      }
    } catch (err) {
      toast('bad', 'Save failed', err instanceof Error ? err.message : 'Check API connection')
    } finally {
      setBusy(false)
    }
  }

  const runPublish = async (row: BlogPostRow) => {
    const next = row.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
    setBusy(true)
    try {
      const saved = await updateBlogPost(row.id, { status: next })
      if (!verifyStringEquals(saved.status, next, 'Post status')) return
      invalidate()
      toast('ok', next === 'PUBLISHED' ? 'Published' : 'Moved to draft', 'Server confirmed status.')
    } catch (err) {
      toast('bad', 'Status update failed', err instanceof Error ? err.message : 'Check API')
    } finally {
      setBusy(false)
    }
  }

  const runDelete = async () => {
    if (!confirmDelete) return
    setBusy(true)
    try {
      const res = await deleteBlogPost(confirmDelete.id)
      if (!verifyBannerDeleteSuccess(res)) return
      setConfirmDelete(null)
      invalidate()
      toast('ok', `${confirmDelete.title} deleted`, 'Removed from blog API.')
    } catch (err) {
      toast('bad', 'Delete failed', err instanceof Error ? err.message : 'Check API')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Content"
        title="Blog"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={posts.isFetching ? 'syncing…' : `${rows.length} post${rows.length === 1 ? '' : 's'}`}
        syncing={posts.isFetching}
        onSync={() => void posts.refetch()}
        actions={[
          {
            label: 'New post',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: openCreate,
          },
        ]}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 0 32px' }}>
        <DcContentNav active="blog" />

        {posts.isLoading ? (
          <DcLoadingState blocks={skeleton} />
        ) : posts.isError ? (
          <DcErrorState
            error={`GET /admin/content/blog → ${posts.error instanceof Error ? posts.error.message : 'API error'}`}
            hint="Existing posts on the API are unaffected — only this list failed to load."
            onRetry={() => void posts.refetch()}
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
                icon="icon-newspaper"
                title="No blog posts yet"
                body="Create a draft, write the body, then publish when ready."
                cta="New post"
                onCta={openCreate}
              />
            ) : (
              <div style={{ ...card, overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      {['Title', 'Status', 'Updated', ''].map((h) => (
                        <th
                          key={h || 'a'}
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
                    {rows.map((row) => {
                      const live = row.status === 'PUBLISHED'
                      return (
                        <tr key={row.id} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>{row.title}</div>
                            {row.excerpt ? (
                              <div style={{ marginTop: 4, font: `400 12px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>
                                {row.excerpt.slice(0, 120)}
                                {row.excerpt.length > 120 ? '…' : ''}
                              </div>
                            ) : null}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span
                              style={{
                                ...toneStyle(live ? 'ok' : 'warn'),
                                display: 'inline-flex',
                                padding: '3px 8px',
                                borderRadius: 999,
                                font: `600 11px/1 ${FONT}`,
                              }}
                            >
                              {live ? 'Published' : 'Draft'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', font: `500 12px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                            {new Date(row.updatedAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <button type="button" onClick={() => openEdit(row)} style={linkBtn}>
                              Edit
                            </button>
                            <button type="button" disabled={busy} onClick={() => void runPublish(row)} style={linkBtn}>
                              {live ? 'Unpublish' : 'Publish'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(row)}
                              style={{ ...linkBtn, color: 'var(--bad)' }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <DcModal
        open={formOpen}
        title={editing ? 'Edit post' : 'New post'}
        subtitle="Saves to /admin/content/blog. Green toast only after the API confirms."
        confirmLabel={busy ? 'Saving…' : 'Save'}
        busy={busy}
        onClose={() => !busy && setFormOpen(false)}
        onConfirm={() => void runSave()}
      >
        <DcField
          label="Title"
          value={form.title}
          onChange={(v) => setForm((f) => ({ ...f, title: v }))}
        />
        <DcField
          label="Excerpt"
          value={form.excerpt}
          onChange={(v) => setForm((f) => ({ ...f, excerpt: v }))}
        />
        <DcField
          label="Body"
          value={form.content}
          onChange={(v) => setForm((f) => ({ ...f, content: v }))}
          area
        />
        <DcField
          label="Featured image URL"
          value={form.featuredImage}
          onChange={(v) => setForm((f) => ({ ...f, featuredImage: v }))}
          placeholder="/images/…"
          mono
        />
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              font: `600 11px/1 ${FONT}`,
              letterSpacing: '.07em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            Status
          </span>
          <select
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({ ...f, status: e.target.value as 'DRAFT' | 'PUBLISHED' }))
            }
            style={{
              padding: '10px 12px',
              borderRadius: 9,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              font: `400 12.5px/1.5 ${FONT}`,
              width: '100%',
            }}
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </label>
      </DcModal>

      <DcModal
        open={Boolean(confirmDelete)}
        title="Delete post?"
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
