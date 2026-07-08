'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { refreshWithToast } from '@/lib/admin/feedback'
import { FolderTree, Pencil, Plus, Trash2 } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { ModulePanelShell } from '@/components/modules/ModulePanelShell'
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/lib/api/hooks'

export function LiveCategoriesPanel() {
  const { data: categories = [], isLoading, isError, refetch } = useCategories()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()
  const [query, setQuery] = useState('')
  const [newName, setNewName] = useState('')
  const [showForm, setShowForm] = useState(false)

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return categories.filter((c) => !q || c.name.toLowerCase().includes(q) || c.slug.includes(q))
  }, [categories, query])

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) {
      toast.error('Category name required')
      return
    }
    try {
      await createCategory.mutateAsync(name)
      toast.success(`${name} category created`)
      setNewName('')
      setShowForm(false)
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create category')
    }
  }

  const handleRename = (id: string, current: string) => {
    const name = window.prompt('Rename category', current)
    if (!name?.trim() || name.trim() === current) return
    updateCategory.mutate(
      { id, name: name.trim() },
      {
        onSuccess: () => toast.success('Category renamed.'),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  const handleDelete = (id: string, name: string, productCount: number) => {
    if (productCount > 0) {
      toast.error(`Move ${productCount} product(s) out of "${name}" before deleting.`)
      return
    }
    if (!window.confirm(`Delete category "${name}"?`)) return
    deleteCategory.mutate(id, {
      onSuccess: () => toast.success('Category deleted.'),
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <div className="space-y-4">
      {isError ? (
        <div className="rounded-[16px] border border-red-200/60 bg-red-50/80 px-4 py-3 text-xs font-semibold text-red-800">
          API offline — start SPLARO API on port 4000, then run `pnpm db:seed` for Women, Men, Kids categories.
        </div>
      ) : null}

      {showForm ? (
        <section className="admin-module-card admin-module-card--accent">
          <h3 className="admin-module-card__title">Add category</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className="admin-input min-w-[200px] flex-1"
              placeholder="e.g. Kids, Men, Summer Collection"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <AdminButton variant="gold" loading={createCategory.isPending} onClick={handleCreate}>
              <Plus className="h-4 w-4" />
              Save
            </AdminButton>
            <AdminButton variant="ghost" onClick={() => setShowForm(false)}>Cancel</AdminButton>
          </div>
        </section>
      ) : null}

      <ModulePanelShell
        kpis={[
          ['Live categories', categories.length, 'default'],
          ['With products', categories.filter((c) => (c._count?.products ?? 0) > 0).length, 'success'],
          ['Empty', categories.filter((c) => (c._count?.products ?? 0) === 0).length, 'warning'],
          ['Inactive', categories.filter((c) => c.isActive === false).length, 'gold'],
        ]}
        pipeline={categories.slice(0, 5).map((c) => [c.name, c._count?.products ?? 0])}
        query={query}
        onQuery={setQuery}
        searchPlaceholder="Search category or slug..."
        createLabel="Add category"
        onCreate={() => setShowForm(true)}
        onRefresh={() => void refreshWithToast(() => refetch(), 'Categories synced from database.')}
        exportDisabled
        tableIcon={FolderTree}
        tableTitle={`Categories · ${filtered.length} live results`}
        footer={isLoading ? 'Loading categories…' : `Showing ${filtered.length} of ${categories.length} — live from API`}
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
            {filtered.map((c) => (
              <tr key={c.id}>
                <td className="font-semibold">{c.name}</td>
                <td className="font-mono text-[10px] text-[var(--admin-text-secondary)]">/{c.slug}</td>
                <td className="font-black">{c._count?.products ?? 0}</td>
                <td className="text-xs">{c.isActive === false ? 'inactive' : 'active'}</td>
                <td>
                  <div className="flex gap-1">
                    <AdminButton size="sm" onClick={() => handleRename(c.id, c.name)}>
                      <Pencil className="h-3 w-3" />
                    </AdminButton>
                    <AdminButton variant="danger" size="sm" onClick={() => handleDelete(c.id, c.name, c._count?.products ?? 0)}>
                      <Trash2 className="h-3 w-3" />
                    </AdminButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm font-semibold text-[var(--admin-text-secondary)]">
            No categories yet. Run `pnpm db:seed` or add Kids, Men, Women above.
          </p>
        ) : null}
      </ModulePanelShell>
    </div>
  )
}
