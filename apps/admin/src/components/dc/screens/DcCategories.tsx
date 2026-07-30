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
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import {
  confirmCategoriesReordered,
  confirmCategoryDeleted,
  confirmCategorySaved,
  confirmCategoryUpdated,
} from '@/lib/admin/catalog-save'
import {
  createCategory,
  deleteCategory,
  fetchCategoryTree,
  reorderCategories,
  updateCategory,
  type CategoryTreeNode,
} from '@/lib/api/categories'
import { revalidateWebCache } from '@/lib/api/revalidate'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const th = {
  textAlign: 'left' as const,
  padding: '9px 15px',
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap' as const,
}

interface FlatNode {
  node: CategoryTreeNode
  depth: number
  path: string
}

/** Depth-first walk so children render directly under their parent, indented. */
function flatten(nodes: CategoryTreeNode[], depth = 0, prefix = ''): FlatNode[] {
  return nodes.flatMap((node) => {
    const path = `${prefix}/${node.slug}`
    return [
      { node, depth, path },
      ...flatten(node.children ?? [], depth + 1, path),
    ]
  })
}

export function DcCategories() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="categories" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcCategoriesBody />
    </DcScreenProvider>
  )
}

function DcCategoriesBody() {
  const { toast } = useDcScreen()
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [removing, setRemoving] = useState<CategoryTreeNode | null>(null)
  const [form, setForm] = useState({ name: '', description: '', parentId: '' })
  const [busy, setBusy] = useState<'create' | 'toggle' | 'delete' | 'reorder' | null>(null)

  const tree = useQuery({
    queryKey: ['category-tree'],
    queryFn: fetchCategoryTree,
    staleTime: 30_000,
  })
  const { api } = useAdminConnection(25_000)

  const roots = useMemo(() => {
    const d = tree.data as { categories?: CategoryTreeNode[] } | CategoryTreeNode[] | undefined
    if (Array.isArray(d)) return d
    return d?.categories ?? []
  }, [tree.data])

  const rows = useMemo(() => flatten(roots), [roots])

  const maxDepth = useMemo(
    () => rows.reduce((deep, r) => Math.max(deep, r.depth + 1), 0),
    [rows],
  )
  const hidden = rows.filter((r) => r.node.isActive === false).length
  const emptyCats = rows.filter((r) => (r.node._count?.products ?? 0) === 0).length
  const totalProducts = rows.reduce((sum, r) => sum + (r.node._count?.products ?? 0), 0)

  const afterCatalogWrite = () => {
    void qc.invalidateQueries({ queryKey: ['category-tree'] })
    void revalidateWebCache(['storefront-products', 'storefront-settings'])
  }

  const runToggle = async (id: string, isActive: boolean) => {
    setBusy('toggle')
    try {
      const ok = await confirmCategoryUpdated(
        id,
        { isActive },
        () => updateCategory(id, { isActive }),
        isActive ? 'Category visible' : 'Category hidden',
      )
      if (ok) afterCatalogWrite()
    } finally {
      setBusy(null)
    }
  }

  const runCreate = async () => {
    const name = form.name.trim()
    if (!name) {
      toast('warn', 'Name is required', 'A category needs a name before it can be saved.')
      return
    }
    setBusy('create')
    try {
      const id = await confirmCategorySaved(
        { name },
        () =>
          createCategory({
            name,
            ...(form.description.trim() ? { description: form.description.trim() } : {}),
            ...(form.parentId ? { parentId: form.parentId } : {}),
          }),
        `${name} category`,
      )
      if (id) {
        setCreateOpen(false)
        setForm({ name: '', description: '', parentId: '' })
        afterCatalogWrite()
      }
    } finally {
      setBusy(null)
    }
  }

  const runDelete = async (id: string) => {
    setBusy('delete')
    try {
      const ok = await confirmCategoryDeleted(id, () => deleteCategory(id))
      if (ok) {
        setRemoving(null)
        afterCatalogWrite()
      }
    } finally {
      setBusy(null)
    }
  }

  // Reorder swaps two siblings and persists the whole sibling run, because
  // sortOrder is only meaningful relative to the rest of the level.
  const runReorder = async (order: { id: string; sortOrder: number }[]) => {
    setBusy('reorder')
    try {
      const ok = await confirmCategoriesReordered(order, () => reorderCategories(order))
      if (ok) afterCatalogWrite()
    } finally {
      setBusy(null)
    }
  }

  const move = (node: CategoryTreeNode, direction: -1 | 1) => {
    if (busy) return
    const siblings = node.parentId
      ? (rows.find((r) => r.node.id === node.parentId)?.node.children ?? [])
      : roots
    const index = siblings.findIndex((c) => c.id === node.id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= siblings.length) return
    const next = [...siblings]
    const held = next[index]!
    next[index] = next[target]!
    next[target] = held
    void runReorder(next.map((c, i) => ({ id: c.id, sortOrder: i })))
  }

  const skeleton: DcBlock[] = [
    { t: 'table', w: 'main', title: '', cols: [], rows: [] } as DcBlock,
    { t: 'list', w: 'side', title: '', items: [] } as DcBlock,
  ]

  const pageStatus = dcPageStatus([tree], api.pulse)

  return (
    <>
      <DcPageHead
        crumbGroup="Catalog"
        title="Categories"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          tree.isFetching ? 'syncing…' : `${rows.length} categor${rows.length === 1 ? 'y' : 'ies'}`
        }
        syncing={tree.isFetching}
        onSync={() => void tree.refetch()}
        actions={[
          {
            label: 'New category',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: () => {
              setForm({ name: '', description: '', parentId: '' })
              setCreateOpen(true)
            },
          },
        ]}
      />

      {tree.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : tree.error ? (
        <DcErrorState
          error={`GET /admin/categories/tree → ${tree.error instanceof Error ? tree.error.message : '500 Internal Server Error'}`}
          hint="The storefront menu is unaffected — only this view failed to load."
          onRetry={() => void tree.refetch()}
        />
      ) : rows.length === 0 ? (
        <DcEmptyState
          icon="icon-folder-tree"
          title="No categories yet"
          body="Categories drive the storefront menu, search facets and product URLs. Build the top level first, then one level of children."
          cta="New category"
          onCta={() => {
            setForm({ name: '', description: '', parentId: '' })
            setCreateOpen(true)
          }}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'flex-start',
            width: '100%',
          }}
        >
          <div style={{ flex: '1 1 56%', minWidth: 340, maxWidth: '100%' }}>
            <div style={{ ...card, overflow: 'auto' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 15px',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <span style={{ flex: 1, font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                  Category tree
                </span>
                <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                  {rows.length} categories · {maxDepth} level{maxDepth === 1 ? '' : 's'}
                </span>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Category</th>
                    <th style={th}>Path</th>
                    <th style={{ ...th, textAlign: 'right' }}>Products</th>
                    <th style={th}>Storefront</th>
                    <th style={{ ...th, textAlign: 'right' }}>&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ node, depth, path }) => {
                    const visible = node.isActive !== false
                    const tone = toneStyle(visible ? 'ok' : 'mute')
                    return (
                      <tr key={node.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '10px 15px' }}>
                          <span
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 3,
                              paddingLeft: depth * 18,
                            }}
                          >
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                font: `500 13px/1.25 ${FONT}`,
                                color: visible ? 'var(--ink)' : 'var(--ink-3)',
                              }}
                            >
                              {depth > 0 ? (
                                <span style={{ color: 'var(--ink-3)' }}>↳</span>
                              ) : null}
                              {node.name}
                            </span>
                            {node.description ? (
                              <span
                                style={{ font: `400 11.5px/1.3 ${FONT}`, color: 'var(--ink-3)' }}
                              >
                                {node.description}
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '10px 15px',
                            font: `500 12px/1 ${MONO}`,
                            color: 'var(--ink-2)',
                          }}
                        >
                          {path}
                        </td>
                        <td
                          style={{
                            padding: '10px 15px',
                            textAlign: 'right',
                            font: `600 13px/1 ${MONO}`,
                            color:
                              (node._count?.products ?? 0) === 0 ? 'var(--ink-3)' : 'var(--ink)',
                          }}
                        >
                          {node._count?.products ?? 0}
                        </td>
                        <td style={{ padding: '10px 15px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '3px 8px',
                              borderRadius: 6,
                              font: `600 11px/1 ${FONT}`,
                              border: `1px solid ${tone.bd}`,
                              background: tone.bg,
                              color: tone.fg,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: 99,
                                background: 'currentColor',
                              }}
                            />
                            {visible ? 'Visible' : 'Hidden'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 15px' }}>
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              justifyContent: 'flex-end',
                            }}
                          >
                            <IconBtn
                              icon="icon-chevron-up"
                              title="Move up"
                              disabled={busy !== null}
                              onClick={() => move(node, -1)}
                            />
                            <IconBtn
                              icon="icon-chevron-down"
                              title="Move down"
                              disabled={busy !== null}
                              onClick={() => move(node, 1)}
                            />
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() => void runToggle(node.id, !visible)}
                              className="dc-hover-ink"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                height: 28,
                                padding: '0 10px',
                                borderRadius: 8,
                                border: `1px solid ${visible ? 'var(--line)' : 'var(--violet-solid)'}`,
                                background: visible ? 'var(--surface-2)' : 'var(--violet-solid)',
                                color: visible ? 'var(--ink-2)' : 'var(--on-violet)',
                                cursor: busy !== null ? 'not-allowed' : 'pointer',
                                font: `600 11.5px/1 ${FONT}`,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <DcIcon name={visible ? 'icon-eye-off' : 'icon-eye'} size={12} />
                              {visible ? 'Hide' : 'Show'}
                            </button>
                            <IconBtn
                              icon="icon-trash-2"
                              title="Delete category"
                              danger
                              disabled={busy !== null}
                              onClick={() => setRemoving(node)}
                            />
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ flex: '1 1 28%', minWidth: 290, maxWidth: '100%' }}>
            <div style={{ ...card, padding: '6px 16px 12px' }}>
              <div
                style={{ padding: '12px 0 10px', font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}
              >
                What this tree drives
              </div>
              <Fact
                icon="icon-folder-tree"
                tone="info"
                title="Depth in use"
                sub="how deep the storefront menu has to render"
                value={`${maxDepth} level${maxDepth === 1 ? '' : 's'}`}
              />
              <Fact
                icon="icon-package"
                tone="ok"
                title="Products categorised"
                sub="summed across every node"
                value={String(totalProducts)}
              />
              <Fact
                icon="icon-eye-off"
                tone={hidden > 0 ? 'warn' : 'mute'}
                title="Hidden from browse"
                sub="still reachable by direct link — hidden is not unpublished"
                value={String(hidden)}
              />
              <Fact
                icon="icon-circle-alert"
                tone={emptyCats > 0 ? 'warn' : 'mute'}
                title="Empty categories"
                sub="render as a dead end on the storefront"
                value={String(emptyCats)}
              />
            </div>
          </div>
        </div>
      )}
      <DcModal
        open={createOpen}
        title="New category"
        subtitle="Categories drive the storefront menu, search facets and product URLs."
        confirmLabel="Create category"
        busy={busy === 'create'}
        onClose={() => setCreateOpen(false)}
        onConfirm={() => void runCreate()}
      >
        <DcField
          label="Name"
          value={form.name}
          onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          placeholder="Abaya"
        />
        <DcField
          label="Description"
          value={form.description}
          onChange={(v) => setForm((f) => ({ ...f, description: v }))}
          placeholder="Signature and everyday abaya"
          area
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
            Parent
          </span>
          <select
            value={form.parentId}
            onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
            style={{
              height: 40,
              padding: '0 10px',
              borderRadius: 9,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              font: `400 12.5px/1 ${FONT}`,
              outline: 'none',
            }}
          >
            <option value="">Top level</option>
            {roots.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <span style={{ font: `400 11.5px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
            Only top-level categories are offered as parents — the storefront menu renders two
            levels.
          </span>
        </label>
      </DcModal>

      <DcModal
        open={removing !== null}
        title={removing ? `Delete ${removing.name}?` : 'Delete category'}
        subtitle={
          removing
            ? `${removing._count?.products ?? 0} product(s) will be left uncategorised. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete category"
        danger
        busy={busy === 'delete'}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && void runDelete(removing.id)}
      />
    </>
  )
}

function IconBtn({
  icon,
  title,
  onClick,
  disabled,
  danger,
}: {
  icon: string
  title: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="dc-hover-ink"
      style={{
        display: 'grid',
        placeItems: 'center',
        width: 28,
        height: 28,
        flex: 'none',
        borderRadius: 8,
        border: `1px solid ${danger ? 'var(--bad-bd)' : 'var(--line)'}`,
        background: danger ? 'var(--bad-soft)' : 'var(--surface-2)',
        color: danger ? 'var(--bad)' : 'var(--ink-3)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <DcIcon name={icon} size={13} />
    </button>
  )
}

function Fact({
  icon,
  tone,
  title,
  sub,
  value,
}: {
  icon: string
  tone: DcTone
  title: string
  sub: string
  value: string
}) {
  const t = toneStyle(tone)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '11px 0',
        borderTop: '1px solid var(--line)',
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
          color: t.fg,
        }}
      >
        <DcIcon name={icon} size={13} />
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ font: `500 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>{title}</span>
        <span
          style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)', textWrap: 'pretty' }}
        >
          {sub}
        </span>
      </span>
      <span
        style={{
          flex: 'none',
          font: `600 12.5px/1 ${MONO}`,
          color: 'var(--ink)',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  )
}
