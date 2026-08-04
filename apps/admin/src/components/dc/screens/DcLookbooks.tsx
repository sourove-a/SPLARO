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
import {
  confirmCollectionSaved,
  confirmCollectionToggled,
  confirmCollectionUpdated,
} from '@/lib/admin/catalog-save'
import {
  createCollection,
  fetchCollections,
  updateCollection,
  type CollectionRow,
} from '@/lib/api/collections'
import { revalidateWebCache } from '@/lib/api/revalidate'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { resolveMediaUrl } from '@/lib/media-url'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

export function DcLookbooks() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="lookbooks" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcLookbooksBody />
    </DcScreenProvider>
  )
}

function DcLookbooksBody() {
  const router = useRouter()
  const { toast } = useDcScreen()
  const qc = useQueryClient()
  const { api } = useAdminConnection(25_000)

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<CollectionRow | null>(null)
  const [form, setForm] = useState({ name: '', description: '', image: '' })
  const [busy, setBusy] = useState<'create' | 'toggle' | 'save' | null>(null)

  const collections = useQuery({
    queryKey: ['collections'],
    queryFn: fetchCollections,
    staleTime: 30_000,
  })

  const rows = useMemo(() => collections.data?.collections ?? [], [collections.data])
  const live = rows.filter((c) => c.isActive)

  const afterWrite = () => {
    void qc.invalidateQueries({ queryKey: ['collections'] })
    void revalidateWebCache(['storefront-products'])
  }

  const pageStatus = dcPageStatus([collections], api.pulse)
  const skeleton: DcBlock[] = [{ t: 'cards', cardMin: '280px', items: [] } as DcBlock]

  const runCreate = async () => {
    const name = form.name.trim()
    if (!name) {
      toast('warn', 'Name required', 'Lookbooks need a name (saved as a collection).')
      return
    }
    setBusy('create')
    try {
      const ok = await confirmCollectionSaved(
        { name, isActive: true },
        () =>
          createCollection(
            name,
            form.description.trim() || undefined,
            form.image.trim() || undefined,
          ),
      )
      if (ok) {
        setCreateOpen(false)
        setForm({ name: '', description: '', image: '' })
        afterWrite()
      }
    } finally {
      setBusy(null)
    }
  }

  const runSave = async () => {
    if (!editing) return
    const name = form.name.trim()
    if (!name) {
      toast('warn', 'Name required', 'Lookbooks need a name.')
      return
    }
    const id = editing.id
    setBusy('save')
    try {
      const ok = await confirmCollectionUpdated(
        id,
        { name },
        () =>
          updateCollection(id, {
            name,
            description: form.description.trim(),
            image: form.image.trim(),
          }),
        'Lookbook',
      )
      if (ok) {
        setEditing(null)
        afterWrite()
      }
    } finally {
      setBusy(null)
    }
  }

  const runToggle = async (id: string, name: string, isActive: boolean) => {
    setBusy('toggle')
    try {
      const ok = await confirmCollectionToggled(id, isActive, name, () =>
        updateCollection(id, { isActive }),
      )
      if (ok) afterWrite()
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Content"
        title="Lookbooks"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          collections.isFetching
            ? 'syncing…'
            : `${rows.length} lookbook${rows.length === 1 ? '' : 's'}`
        }
        syncing={collections.isFetching}
        onSync={() => void collections.refetch()}
        actions={[
          {
            label: 'New lookbook',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: () => {
              setForm({ name: '', description: '', image: '' })
              setCreateOpen(true)
            },
          },
          {
            label: 'Open Collections',
            icon: 'icon-layers',
            variant: 'ghost',
            onClick: () => router.push('/dashboard/collections'),
          },
        ]}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 0 32px' }}>
        <DcContentNav active="lookbooks" />
        <p style={{ margin: 0, font: `400 13px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
          Editorial lookbooks are product collections. Create, edit, and toggle visibility here — full
          product assignment stays in Collections.
        </p>

        {collections.isLoading ? (
          <DcLoadingState blocks={skeleton} />
        ) : collections.isError ? (
          <DcErrorState
            error={`GET /admin/collections → ${collections.error instanceof Error ? collections.error.message : 'API error'}`}
            hint="Collections already on the storefront are unaffected."
            onRetry={() => void collections.refetch()}
          />
        ) : rows.length === 0 ? (
          <DcEmptyState
            icon="icon-book-open"
            title="No lookbooks yet"
            body="Create a collection to use as an editorial lookbook."
            cta="New lookbook"
            onCta={() => setCreateOpen(true)}
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 12,
            }}
          >
            {rows.map((c) => {
              const img = c.image ? resolveMediaUrl(c.image) : null
              return (
                <div key={c.id} style={{ ...card, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: 140,
                      background: 'var(--bg)',
                      backgroundImage: img ? `url(${img})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
                      <div style={{ font: `700 15px/1.25 ${FONT}`, color: 'var(--ink)' }}>{c.name}</div>
                      <span
                        style={{
                          ...toneStyle(c.isActive ? 'ok' : 'warn'),
                          padding: '3px 8px',
                          borderRadius: 999,
                          font: `600 10px/1 ${FONT}`,
                          flexShrink: 0,
                        }}
                      >
                        {c.isActive ? 'Live' : 'Off'}
                      </span>
                    </div>
                    <div style={{ font: `500 12px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                      {c._count?.products ?? 0} products · /{c.slug}
                    </div>
                    {c.description ? (
                      <p style={{ margin: 0, font: `400 12px/1.4 ${FONT}`, color: 'var(--ink-2)' }}>
                        {c.description.slice(0, 100)}
                        {c.description.length > 100 ? '…' : ''}
                      </p>
                    ) : null}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                      <button
                        type="button"
                        style={btn}
                        onClick={() => {
                          setForm({
                            name: c.name,
                            description: c.description ?? '',
                            image: c.image ?? '',
                          })
                          setEditing(c)
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        style={btn}
                        disabled={busy === 'toggle'}
                        onClick={() => void runToggle(c.id, c.name, !c.isActive)}
                      >
                        {c.isActive ? 'Hide' : 'Show'}
                      </button>
                      <button
                        type="button"
                        style={btn}
                        onClick={() => router.push('/dashboard/collections')}
                      >
                        Products
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ font: `500 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>
          {live.length} live · {rows.length - live.length} hidden
        </div>
      </div>

      <DcModal
        open={createOpen}
        title="New lookbook"
        subtitle="Creates an active collection used as a lookbook."
        confirmLabel={busy === 'create' ? 'Saving…' : 'Create'}
        busy={busy === 'create'}
        onClose={() => busy !== 'create' && setCreateOpen(false)}
        onConfirm={() => void runCreate()}
      >
        <LookbookFields form={form} setForm={setForm} />
      </DcModal>

      <DcModal
        open={Boolean(editing)}
        title="Edit lookbook"
        subtitle="Updates the collection fields on the server."
        confirmLabel={busy === 'save' ? 'Saving…' : 'Save'}
        busy={busy === 'save'}
        onClose={() => busy !== 'save' && setEditing(null)}
        onConfirm={() => void runSave()}
      >
        <LookbookFields form={form} setForm={setForm} />
      </DcModal>
    </>
  )
}

function LookbookFields({
  form,
  setForm,
}: {
  form: { name: string; description: string; image: string }
  setForm: (fn: (f: typeof form) => typeof form) => void
}) {
  return (
    <>
      <DcField
        label="Name"
        value={form.name}
        onChange={(v) => setForm((f) => ({ ...f, name: v }))}
      />
      <DcField
        label="Description"
        value={form.description}
        onChange={(v) => setForm((f) => ({ ...f, description: v }))}
        area
      />
      <DcField
        label="Cover image URL"
        value={form.image}
        onChange={(v) => setForm((f) => ({ ...f, image: v }))}
        mono
      />
    </>
  )
}

const btn: CSSProperties = {
  height: 30,
  padding: '0 10px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  font: `600 12px/1 ${FONT}`,
  color: 'var(--ink-2)',
  cursor: 'pointer',
}
