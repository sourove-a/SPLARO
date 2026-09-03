'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { dcPageStatus } from '@/components/dc/page-status'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import { DcField, DcModal } from '@/components/dc/DcModal'
import { DcCard, DcCardHead } from '@/components/dc/primitives/DcCard'
import { DcTable } from '@/components/dc/primitives/DcTable'
import type { DcBlock } from '@/components/dc/blocks/types'
import { FONT, MONO, formatCount, toneStyle, type DcTone } from '@/components/dc/tokens'
import {
  confirmCategoriesReordered,
  confirmCategoryDeleted,
  confirmCategorySaved,
  confirmCategoryUpdated,
} from '@/lib/admin/catalog-save'
import { downloadCsv } from '@/lib/admin/admin-actions'
import {
  categoryParentOptions,
  flattenCategoryTree,
  MAX_CATEGORY_DEPTH,
  type FlatCategoryNode,
} from '@/lib/admin/category-parent-options'
import { categoryTreeRoots } from '@/lib/admin/category-tree-roots'
import {
  createCategory,
  deleteCategory,
  reorderCategories,
  updateCategory,
  type CategoryTreeNode,
} from '@/lib/api/categories'
import { CATEGORY_WEB_TAGS, useCategoryTree } from '@/lib/api/hooks'
import { revalidateWebCache } from '@/lib/api/revalidate'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

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
  const [editing, setEditing] = useState<CategoryTreeNode | null>(null)
  const [removing, setRemoving] = useState<CategoryTreeNode | null>(null)
  const [form, setForm] = useState({ name: '', description: '', parentId: '' })
  const [editForm, setEditForm] = useState({ name: '', description: '', parentId: '' })
  const [busy, setBusy] = useState<'create' | 'edit' | 'toggle' | 'delete' | 'reorder' | null>(null)

  // Same query key the product form reads (`useCategoryTree`) — a separate key
  // here meant a category created on this screen never reached "Add product".
  const tree = useCategoryTree()
  const { api } = useAdminConnection(25_000)

  const roots = useMemo(() => categoryTreeRoots(tree.data), [tree.data])

  const rows = useMemo(() => flattenCategoryTree(roots), [roots])

  const maxDepth = useMemo(
    () => rows.reduce((deep, r) => Math.max(deep, r.depth + 1), 0),
    [rows],
  )
  const hidden = rows.filter((r) => r.node.isActive === false).length
  const emptyCats = rows.filter((r) => (r.node._count?.products ?? 0) === 0).length
  const totalProducts = rows.reduce(
    (sum, r) => sum + (r.node.totalProducts ?? r.node._count?.products ?? 0),
    0,
  )

  // `['categories']` is the prefix of both the flat list and the tree, so one
  // call refreshes every screen that reads categories, this one included.
  const afterCatalogWrite = () => {
    void qc.invalidateQueries({ queryKey: ['categories'] })
    void revalidateWebCache(CATEGORY_WEB_TAGS)
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

  const openEdit = (node: CategoryTreeNode) => {
    setEditForm({
      name: node.name,
      description: node.description ?? '',
      parentId: node.parentId ?? '',
    })
    setEditing(node)
  }

  const runEdit = async () => {
    if (!editing) return
    const name = editForm.name.trim()
    if (!name) {
      toast('warn', 'Name is required', 'A category needs a name before it can be saved.')
      return
    }
    // The slug is the public URL and stays as it was — renaming a category must
    // not break links, ads or anything already indexed.
    const patch = {
      name,
      description: editForm.description.trim(),
      parentId: editForm.parentId || null,
    }
    setBusy('edit')
    try {
      const ok = await confirmCategoryUpdated(
        editing.id,
        { name },
        () => updateCategory(editing.id, patch),
        'Category updated',
      )
      if (ok) {
        setEditing(null)
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

  const exportCsv = () => {
    if (rows.length === 0) {
      toast('warn', 'Nothing to export', 'No categories to export.')
      return
    }
    const headers = [
      'Category Name',
      'Slug',
      'Level Depth',
      'URL Path',
      'Products Total',
      'Products Live',
      'Storefront Visibility',
      'Description',
    ]
    const csvRows = [
      headers,
      ...rows.map(({ node, depth, path }) => {
        const live = node._count?.products ?? 0
        return [
          node.name,
          node.slug,
          String(depth + 1),
          path,
          String(node.totalProducts ?? live),
          String(live),
          node.isActive !== false ? 'Visible' : 'Hidden',
          node.description || '',
        ]
      }),
    ]
    downloadCsv(`splaro-categories-${new Date().toISOString().slice(0, 10)}.csv`, csvRows)
    toast('ok', 'Categories exported', `Exported ${rows.length} categories to CSV.`)
  }

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
          {
            label: 'Export CSV',
            icon: 'icon-download',
            onClick: exportCsv,
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
        <div className="dc-split">
          <div className="dc-split__main">
            <DcCard clip>
              <DcCardHead
                title="Category tree"
                meta={`${rows.length} categories · ${maxDepth} level${maxDepth === 1 ? '' : 's'}`}
              />

              <DcTable sticky>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Path</th>
                    <th className="is-num">Products</th>
                    <th>Storefront</th>
                    <th className="is-num">&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ node, depth, path }) => {
                    const visible = node.isActive !== false
                    const live = node._count?.products ?? 0
                    // Drafts and archived products still block a delete, so the
                    // column shows the real total, not just what the site shows.
                    const total = node.totalProducts ?? live
                    const empty = live === 0
                    const tone = toneStyle(!visible ? 'mute' : empty ? 'warn' : 'ok')
                    return (
                      <tr key={node.id}>
                        <td>
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
                        <td className="is-mono" style={{ color: 'var(--ink-2)' }}>
                          {path}
                        </td>
                        <td
                          className="is-num"
                          style={{ color: total === 0 ? 'var(--ink-3)' : 'var(--ink)' }}
                          title={total !== live ? `${live} live · ${total - live} draft or archived` : undefined}
                        >
                          {total}
                        </td>
                        <td>
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
                            {!visible ? 'Hidden' : empty ? 'Empty — hidden on site' : 'Visible'}
                          </span>
                        </td>
                        <td>
                          <span className="dc-row-tools" style={{ alignItems: 'center' }}>
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
                              icon="icon-pencil"
                              title="Edit category"
                              disabled={busy !== null}
                              onClick={() => openEdit(node)}
                            />
                            <IconBtn
                              icon="icon-trash-2"
                              title={
                                total > 0
                                  ? `${total} product(s) are still here — move them first`
                                  : 'Delete category'
                              }
                              danger
                              disabled={busy !== null || total > 0}
                              onClick={() => setRemoving(node)}
                            />
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </DcTable>
            </DcCard>
          </div>

          <div className="dc-split__rail">
            <DcCard style={{ padding: '6px 16px 12px' }}>
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
                value={formatCount(totalProducts)}
              />
              <Fact
                icon="icon-eye-off"
                tone={hidden > 0 ? 'warn' : 'mute'}
                title="Hidden from browse"
                sub="still reachable by direct link — hidden is not unpublished"
                value={formatCount(hidden)}
              />
              <Fact
                icon="icon-circle-alert"
                tone={emptyCats > 0 ? 'warn' : 'mute'}
                title="Empty categories"
                sub="render as a dead end on the storefront"
                value={formatCount(emptyCats)}
              />
            </DcCard>
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
        <ParentSelect
          value={form.parentId}
          options={categoryParentOptions(rows, null)}
          onChange={(parentId) => setForm((f) => ({ ...f, parentId }))}
        />
      </DcModal>

      <DcModal
        open={editing !== null}
        title={editing ? `Edit ${editing.name}` : 'Edit category'}
        subtitle="The URL path stays as it is — renaming never breaks a link that is already live."
        confirmLabel="Save category"
        busy={busy === 'edit'}
        onClose={() => setEditing(null)}
        onConfirm={() => void runEdit()}
      >
        <DcField
          label="Name"
          value={editForm.name}
          onChange={(v) => setEditForm((f) => ({ ...f, name: v }))}
          placeholder="Abaya"
        />
        <DcField
          label="Description"
          value={editForm.description}
          onChange={(v) => setEditForm((f) => ({ ...f, description: v }))}
          placeholder="Signature and everyday abaya"
          area
        />
        <ParentSelect
          value={editForm.parentId}
          options={categoryParentOptions(rows, editing)}
          onChange={(parentId) => setEditForm((f) => ({ ...f, parentId }))}
        />
      </DcModal>

      <DcModal
        open={removing !== null}
        title={removing ? `Delete ${removing.name}?` : 'Delete category'}
        subtitle={
          removing
            ? (removing.totalProducts ?? removing._count?.products ?? 0) > 0
              ? `${removing.totalProducts ?? removing._count?.products} product(s) still sit here — move them to another category first.`
              : (removing.children?.length ?? 0) > 0
                ? `Its ${removing.children?.length} subcategor${(removing.children?.length ?? 0) === 1 ? 'y' : 'ies'} become top-level categories. This cannot be undone.`
                : 'This cannot be undone.'
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

function ParentSelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: FlatCategoryNode[]
  onChange: (parentId: string) => void
}) {
  return (
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
        {options.map(({ node, depth }) => (
          <option key={node.id} value={node.id}>
            {`${'— '.repeat(depth)}${node.name}`}
          </option>
        ))}
      </select>
      <span style={{ font: `400 11.5px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
        The storefront menu renders {MAX_CATEGORY_DEPTH} levels, so a category that would push the branch
        deeper is not offered here — nor is the category itself or anything under it.
      </span>
    </label>
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
