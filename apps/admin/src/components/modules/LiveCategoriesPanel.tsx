'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FolderTree, ImageIcon, Pencil, Plus, Sprout, Trash2 } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { ModulePanelShell } from '@/components/modules/ModulePanelShell'
import { MediaPickerModal } from '@/components/media/MediaPickerModal'
import {
  useCategoryTree,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useSeedDefaultCategories,
  usePermission,
} from '@/lib/api/hooks'
import type { CategoryTreeNode } from '@/lib/api/categories'
import { toastFail, refreshWithToast, toastOk } from '@/lib/admin/feedback'
import {
  confirmCategoryDeleted,
  confirmCategoryRenamed,
  confirmCategorySaved,
  confirmCategoryUpdated,
} from '@/lib/admin/catalog-save'
import { PERMISSION_DENIED_TITLE } from '@/lib/auth/permissions'
import { DEPARTMENT_SLUGS } from '@splaro/config'

function TreeRow({
  node,
  depth,
  expanded,
  onToggle,
  onRename,
  onDelete,
  onImage,
  onToggleActive,
  canEdit,
  canDelete,
}: {
  node: CategoryTreeNode
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string, name: string, count: number) => void
  onImage: (id: string, current?: string | null) => void
  onToggleActive: (id: string, active: boolean) => void
  canEdit: boolean
  canDelete: boolean
}) {
  const hasChildren = node.children.length > 0
  const isOpen = expanded.has(node.id)
  const productCount = node._count?.products ?? 0

  return (
    <>
      <tr>
        <td className="font-semibold">
          <div className="flex items-center gap-1" style={{ paddingLeft: depth * 16 }}>
            {hasChildren ? (
              <button type="button" className="rounded p-0.5 hover:bg-black/5" onClick={() => onToggle(node.id)}>
                {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="inline-block w-5" />
            )}
            {node.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={node.image} alt="" className="h-6 w-6 rounded object-cover" />
            ) : null}
            {node.name}
            {DEPARTMENT_SLUGS.includes(node.slug as (typeof DEPARTMENT_SLUGS)[number]) && depth === 0 ? (
              <span className="ml-1 rounded bg-[rgba(200,169,126,0.15)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#8a6d45]">
                dept
              </span>
            ) : null}
          </div>
        </td>
        <td className="font-mono text-[10px] text-[var(--admin-text-secondary)]">/{node.slug}</td>
        <td className="font-black">{productCount}</td>
        <td className="text-xs">{node.isActive === false ? 'inactive' : 'active'}</td>
        <td>
          <div className="flex gap-1">
            {canEdit && (
              <>
                <AdminButton size="sm" onClick={() => onImage(node.id, node.image)}>
                  <ImageIcon className="h-3 w-3" />
                </AdminButton>
                <AdminButton size="sm" onClick={() => onRename(node.id, node.name)}>
                  <Pencil className="h-3 w-3" />
                </AdminButton>
                <AdminButton
                  size="sm"
                  variant="ghost"
                  onClick={() => onToggleActive(node.id, node.isActive !== false)}
                >
                  {node.isActive === false ? 'Enable' : 'Hide'}
                </AdminButton>
              </>
            )}
            {canDelete && (
              <AdminButton variant="danger" size="sm" onClick={() => onDelete(node.id, node.name, productCount)}>
                <Trash2 className="h-3 w-3" />
              </AdminButton>
            )}
          </div>
        </td>
      </tr>
      {hasChildren && isOpen
        ? node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onRename={onRename}
              onDelete={onDelete}
              onImage={onImage}
              onToggleActive={onToggleActive}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))
        : null}
    </>
  )
}

function flattenVisible(tree: CategoryTreeNode[], expanded: Set<string>): CategoryTreeNode[] {
  const out: CategoryTreeNode[] = []
  for (const node of tree) {
    out.push(node)
    if (node.children.length && expanded.has(node.id)) {
      out.push(...flattenVisible(node.children, expanded))
    }
  }
  return out
}

export function LiveCategoriesPanel() {
  const { data, isLoading, isError, refetch } = useCategoryTree()
  const tree = data?.tree ?? []
  const flat = data?.categories ?? []
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()
  const seedDefaults = useSeedDefaultCategories()
  const canDelete = usePermission('products', 'delete')
  const canCreate = usePermission('products', 'create')
  const canEdit = usePermission('products', 'edit')
  const [query, setQuery] = useState('')
  const [newName, setNewName] = useState('')
  const [parentId, setParentId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [imagePicker, setImagePicker] = useState<{ id: string } | null>(null)

  const departments = useMemo(
    () => flat.filter((c) => !c.parentId && DEPARTMENT_SLUGS.includes(c.slug as (typeof DEPARTMENT_SLUGS)[number])),
    [flat],
  )

  const missingDepartments = DEPARTMENT_SLUGS.filter((slug) => !departments.some((d) => d.slug === slug))

  const filteredTree = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return tree
    const matchIds = new Set(
      flat.filter((c) => c.name.toLowerCase().includes(q) || c.slug.includes(q)).map((c) => c.id),
    )
    const filterNodes = (nodes: CategoryTreeNode[]): CategoryTreeNode[] =>
      nodes
        .map((node) => {
          const children = filterNodes(node.children)
          if (matchIds.has(node.id) || children.length) return { ...node, children }
          return null
        })
        .filter(Boolean) as CategoryTreeNode[]
    return filterNodes(tree)
  }, [flat, query, tree])

  const visibleCount = useMemo(() => flattenVisible(filteredTree, expanded).length, [expanded, filteredTree])

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) {
      toastFail('Category name required')
      return
    }
    const payload = { name, ...(parentId ? { parentId } : {}) }
    const ok = await confirmCategorySaved({ name }, () => createCategory.mutateAsync(payload), `${name} category`)
    if (ok) {
      setNewName('')
      setParentId('')
      setShowForm(false)
      void refetch()
    }
  }

  const handleSeed = async () => {
    try {
      const res = await seedDefaults.mutateAsync()
      toastOk(`Seeded ${res.departments} departments, ${res.subcategories} subcategories.`)
      void refetch()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Seed failed')
    }
  }

  const handleRename = async (id: string, current: string) => {
    const name = window.prompt('Rename category', current)
    if (!name?.trim() || name.trim() === current) return
    const trimmed = name.trim()
    const ok = await confirmCategoryRenamed(id, trimmed, () =>
      updateCategory.mutateAsync({ id, name: trimmed }),
    )
    if (ok) void refetch()
  }

  const handleDelete = async (id: string, name: string, productCount: number) => {
    if (productCount > 0) {
      toastFail(`Move ${productCount} product(s) out of "${name}" before deleting.`)
      return
    }
    if (!window.confirm(`Delete category "${name}"?`)) return
    const ok = await confirmCategoryDeleted(id, () => deleteCategory.mutateAsync(id))
    if (ok) void refetch()
  }

  const handleToggleActive = async (id: string, currentlyActive: boolean) => {
    const nextActive = !currentlyActive
    const ok = await confirmCategoryUpdated(
      id,
      { isActive: nextActive },
      () => updateCategory.mutateAsync({ id, isActive: nextActive }),
      nextActive ? 'Category enabled' : 'Category hidden',
    )
    if (ok) void refetch()
  }

  const handleImageSelected = async (url: string) => {
    if (!imagePicker) return
    const id = imagePicker.id
    const ok = await confirmCategoryUpdated(
      id,
      { image: url },
      () => updateCategory.mutateAsync({ id, image: url }),
      'Category image',
    )
    if (ok) {
      setImagePicker(null)
      void refetch()
    }
  }

  return (
    <div className="space-y-4">
      {isError ? (
        <div className="rounded-[16px] border border-red-200/60 bg-red-50/80 px-4 py-3 text-xs font-semibold text-red-800">
          API offline — start SPLARO API on port 4000, then seed default categories.
        </div>
      ) : null}

      {missingDepartments.length > 0 && !isError ? (
        <section className="admin-module-card admin-module-card--accent">
          <h3 className="admin-module-card__title flex items-center gap-2">
            <Sprout className="h-4 w-4" />
            Missing departments
          </h3>
          <p className="admin-module-card__text mt-1">
            {missingDepartments.join(', ')} not in database. Seed the default Men / Women / Kids / Footwear tree.
          </p>
          <AdminButton variant="gold" className="mt-3" loading={seedDefaults.isPending} onClick={handleSeed}>
            Seed default category tree
          </AdminButton>
        </section>
      ) : null}

      {showForm ? (
        <section className="admin-module-card admin-module-card--accent">
          <h3 className="admin-module-card__title">Add category</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <input
              className="admin-input"
              placeholder="Category name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <select className="admin-input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">Top level (no parent)</option>
              {flat.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parentId ? `— ${c.name}` : c.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <AdminButton variant="gold" loading={createCategory.isPending} onClick={handleCreate}>
                <Plus className="h-4 w-4" />
                Save
              </AdminButton>
              <AdminButton variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </AdminButton>
            </div>
          </div>
        </section>
      ) : null}

      <ModulePanelShell
        kpis={[
          ['Live categories', flat.length, 'default'],
          ['With products', flat.filter((c) => (c._count?.products ?? 0) > 0).length, 'success'],
          ['Departments', departments.length, 'gold'],
          ['Inactive', flat.filter((c) => c.isActive === false).length, 'warning'],
        ]}
        pipeline={flat.slice(0, 5).map((c) => [c.name, c._count?.products ?? 0])}
        query={query}
        onQuery={setQuery}
        searchPlaceholder="Search category or slug..."
        createLabel="Add category"
        onCreate={() => setShowForm(true)}
        createDisabled={!canCreate}
        disabledActionTitle={PERMISSION_DENIED_TITLE}
        onRefresh={() => void refreshWithToast(() => refetch(), 'Categories synced from database.')}
        exportDisabled
        tableIcon={FolderTree}
        tableTitle={`Category tree · ${visibleCount} visible`}
        footer={isLoading ? 'Loading categories…' : `Tree from API — ${flat.length} total nodes`}
      >
        <table className="admin-module-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Slug</th>
              <th>Products</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filteredTree.map((node) => (
              <TreeRow
                key={node.id}
                node={node}
                depth={0}
                expanded={expanded}
                onToggle={toggleExpanded}
                onRename={handleRename}
                onDelete={handleDelete}
                onImage={(id) => setImagePicker({ id })}
                onToggleActive={handleToggleActive}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            ))}
          </tbody>
        </table>
        {!isLoading && filteredTree.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm font-semibold text-[var(--admin-text-secondary)]">
            No categories yet. Seed defaults or add a department above.
          </p>
        ) : null}
      </ModulePanelShell>

      <MediaPickerModal
        open={Boolean(imagePicker)}
        onClose={() => setImagePicker(null)}
        onSelect={handleImageSelected}
        title="Category image"
      />
    </div>
  )
}
