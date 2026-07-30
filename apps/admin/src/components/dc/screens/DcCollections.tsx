'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { dcPageStatus } from '@/components/dc/page-status'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import { DcField, DcModal } from '@/components/dc/DcModal'
import type { DcBlock } from '@/components/dc/blocks/types'
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
import { useProducts } from '@/lib/api/hooks'
import { revalidateWebCache } from '@/lib/api/revalidate'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { resolveMediaUrl } from '@/lib/media-url'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const capsLabel = {
  font: `600 11px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
}

export function DcCollections() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="collections" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcCollectionsBody />
    </DcScreenProvider>
  )
}

function DcCollectionsBody() {
  const { toast } = useDcScreen()
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<CollectionRow | null>(null)
  const [form, setForm] = useState({ name: '', description: '', image: '' })
  const [busy, setBusy] = useState<'create' | 'toggle' | 'save' | null>(null)

  const openCreate = () => {
    setForm({ name: '', description: '', image: '' })
    setCreateOpen(true)
  }

  const openEdit = (c: CollectionRow) => {
    setForm({ name: c.name, description: c.description ?? '', image: c.image ?? '' })
    setEditing(c)
  }

  const collections = useQuery({
    queryKey: ['collections'],
    queryFn: fetchCollections,
    staleTime: 30_000,
  })
  const products = useProducts({ limit: 300 })
  const { api } = useAdminConnection(25_000)

  const rows = useMemo(() => collections.data?.collections ?? [], [collections.data])
  const catalog = useMemo(() => products.data?.products ?? [], [products.data])

  const live = rows.filter((c) => c.isActive)
  const drafts = rows.filter((c) => !c.isActive)
  const assigned = rows.reduce((sum, c) => sum + (c._count?.products ?? 0), 0)
  const orphans = useMemo(
    () => catalog.filter((p) => (p.collections?.length ?? 0) === 0).length,
    [catalog],
  )
  const largest = useMemo(
    () =>
      rows.length > 0
        ? rows.reduce((top, c) =>
            (c._count?.products ?? 0) > (top._count?.products ?? 0) ? c : top,
          )
        : null,
    [rows],
  )

  const afterWrite = () => {
    void qc.invalidateQueries({ queryKey: ['collections'] })
    void revalidateWebCache(['storefront-products'])
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

  const runCreate = async () => {
    const name = form.name.trim()
    if (!name) {
      toast('warn', 'Name is required', 'A collection needs a name before it can be saved.')
      return
    }
    setBusy('create')
    try {
      // API creates collections as active by default — verify that, not a fake draft claim.
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
      toast('warn', 'Name is required', 'A collection needs a name before it can be saved.')
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
        'Collection',
      )
      if (ok) {
        setEditing(null)
        afterWrite()
      }
    } finally {
      setBusy(null)
    }
  }

  const skeleton: DcBlock[] = [
    { t: 'kpis' } as DcBlock,
    { t: 'cards', cardMin: '300px', items: [] } as DcBlock,
  ]

  const pageStatus = dcPageStatus([collections, products], api.pulse)

  return (
    <>
      <DcPageHead
        crumbGroup="Catalog"
        title="Collections"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          collections.isFetching
            ? 'syncing…'
            : `${rows.length} collection${rows.length === 1 ? '' : 's'}`
        }
        syncing={collections.isFetching}
        onSync={() => {
          void collections.refetch()
          void products.refetch()
        }}
        actions={[
          {
            label: 'New collection',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: openCreate,
          },
        ]}
      />

      {collections.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : collections.error ? (
        <DcErrorState
          error={`GET /admin/collections → ${collections.error instanceof Error ? collections.error.message : '500 Internal Server Error'}`}
          hint="Collections already on the storefront are unaffected — only this view failed to load."
          onRetry={() => void collections.refetch()}
        />
      ) : rows.length === 0 ? (
        <DcEmptyState
          icon="icon-layers"
          title="No collections yet"
          body="Collections group products for the storefront menu and campaigns. Start with one manual collection so the menu has something to point at."
          cta="New collection"
          onCta={openCreate}
        />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(206px, 1fr))',
              gap: 12,
            }}
          >
            <Kpi
              label="Collections"
              value={String(rows.length)}
              sub={`${live.length} live on the storefront`}
            />
            <Kpi
              label="Drafts"
              value={String(drafts.length)}
              sub="hidden until published"
              color={drafts.length > 0 ? 'var(--warn)' : 'var(--ink)'}
            />
            <Kpi
              label="Products assigned"
              value={String(assigned)}
              sub={
                products.isLoading
                  ? 'counting products in none…'
                  : `${orphans} product${orphans === 1 ? '' : 's'} in none`
              }
              color={orphans > 0 ? 'var(--warn)' : 'var(--ink)'}
            />
            <Kpi
              label="Largest collection"
              value={largest?.name ?? '—'}
              sub={`${largest?._count?.products ?? 0} products assigned`}
              color="var(--ok)"
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 12,
            }}
          >
            {rows.map((c) => (
              <CollectionCard
                key={c.id}
                collection={c}
                busy={busy !== null}
                onEdit={() => openEdit(c)}
                onToggle={() => void runToggle(c.id, c.name, !c.isActive)}
              />
            ))}
          </div>

          {/* The design also shows a schedule window and 30-day revenue per
              collection. Neither is stored or reported by the API, so the cards
              carry what it does return rather than an invented figure. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '11px 14px',
              borderRadius: 11,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
            }}
          >
            <DcIcon name="icon-info" size={14} color="var(--ink-3)" />
            <span
              style={{
                flex: 1,
                font: `400 12px/1.5 ${FONT}`,
                color: 'var(--ink-3)',
                textWrap: 'pretty',
              }}
            >
              Scheduling windows and per-collection revenue are not stored by{' '}
              <span style={{ fontFamily: 'var(--mono)' }}>/admin/collections</span> yet, so those
              rows are left out instead of estimated.
            </span>
          </div>
        </>
      )}
      <DcModal
        open={createOpen}
        title="New collection"
        subtitle="Saved to the catalog after the server confirms the name. Hide it from the card if it should stay off the storefront."
        confirmLabel="Create collection"
        busy={busy === 'create'}
        onClose={() => setCreateOpen(false)}
        onConfirm={() => void runCreate()}
      >
        <DcField
          label="Name"
          value={form.name}
          onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          placeholder="The Eid Edit"
        />
        <DcField
          label="Description"
          value={form.description}
          onChange={(v) => setForm((f) => ({ ...f, description: v }))}
          placeholder="Hand-picked festive pieces"
          area
        />
        <DcField
          label="Cover image URL"
          value={form.image}
          onChange={(v) => setForm((f) => ({ ...f, image: v }))}
          placeholder="/uploads/collections/eid-edit.webp"
          mono
          hint="Upload in Media Library first, then paste the path here."
        />
      </DcModal>

      <DcModal
        open={editing !== null}
        title={editing ? `Edit ${editing.name}` : 'Edit collection'}
        subtitle="Saves immediately. Visibility is changed from the card, not here."
        confirmLabel="Save changes"
        busy={busy === 'save'}
        onClose={() => setEditing(null)}
        onConfirm={() => void runSave()}
      >
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
      </DcModal>
    </>
  )
}

function CollectionCard({
  collection,
  busy,
  onEdit,
  onToggle,
}: {
  collection: CollectionRow
  busy: boolean
  onEdit: () => void
  onToggle: () => void
}) {
  const tone = toneStyle(collection.isActive ? 'ok' : 'mute')
  const cover = collection.image ? resolveMediaUrl(collection.image) : null

  return (
    <div
      style={{
        ...card,
        padding: '14px 15px',
        display: 'flex',
        flexDirection: 'column',
        gap: 11,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span
            style={{ font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)', textWrap: 'pretty' }}
          >
            {collection.name}
          </span>
          <span style={{ font: `400 11.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
            {collection.description?.trim() || `/collections/${collection.slug}`}
          </span>
        </span>
        <span
          style={{
            flex: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 8px',
            borderRadius: 6,
            font: `600 10.5px/1 ${FONT}`,
            letterSpacing: '.04em',
            border: `1px solid ${tone.bd}`,
            background: tone.bg,
            color: tone.fg,
            whiteSpace: 'nowrap',
          }}
        >
          {collection.isActive ? 'LIVE' : 'DRAFT'}
        </span>
      </div>

      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt=""
          style={{
            display: 'block',
            width: '100%',
            height: 112,
            objectFit: 'cover',
            borderRadius: 9,
            border: '1px solid var(--line)',
          }}
        />
      ) : (
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            width: '100%',
            height: 112,
            borderRadius: 9,
            border: '1px dashed var(--line-2)',
            background:
              'repeating-linear-gradient(135deg, var(--surface-2), var(--surface-2) 6px, var(--surface-3) 6px, var(--surface-3) 12px)',
            color: 'var(--ink-3)',
            font: `500 10.5px/1 ${FONT}`,
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <DcIcon name="icon-image" size={15} />
            <span>No cover image</span>
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <Row label="Products" value={String(collection._count?.products ?? 0)} />
        <Row label="Handle" value={`/${collection.slug}`} mono />
      </div>

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', paddingTop: 2 }}>
        <button
          type="button"
          onClick={onEdit}
          className="dc-hover-ink"
          style={{
            height: 28,
            padding: '0 11px',
            borderRadius: 8,
            border: '1px solid var(--line)',
            background: 'var(--surface-2)',
            color: 'var(--ink-2)',
            cursor: 'pointer',
            font: `600 11.5px/1 ${FONT}`,
          }}
        >
          Edit
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 28,
            padding: '0 11px',
            borderRadius: 8,
            cursor: busy ? 'not-allowed' : 'pointer',
            font: `600 11.5px/1 ${FONT}`,
            border: `1px solid ${collection.isActive ? 'var(--line)' : 'var(--violet-solid)'}`,
            background: collection.isActive ? 'var(--surface-2)' : 'var(--violet-solid)',
            color: collection.isActive ? 'var(--ink-2)' : 'var(--on-violet)',
          }}
        >
          <DcIcon name={collection.isActive ? 'icon-eye-off' : 'icon-globe'} size={12} />
          <span>{collection.isActive ? 'Hide from site' : 'Publish'}</span>
        </button>
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ flex: 1, font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>{label}</span>
      <span
        style={{
          font: `600 12px/1 ${mono ? MONO : FONT}`,
          color: 'var(--ink)',
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub: string
  color?: string
}) {
  return (
    <div
      style={{ ...card, padding: '14px 15px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <span style={capsLabel}>{label}</span>
      <span
        style={{
          font: `700 25px/1 ${FONT}`,
          letterSpacing: '-.025em',
          color: color ?? 'var(--ink)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
      <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
    </div>
  )
}
