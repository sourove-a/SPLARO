import { apiFetch } from './client'

export interface CategoryRow {
  id: string
  name: string
  slug: string
  image?: string | null
  parentId?: string | null
  sortOrder?: number
  isActive?: boolean
  description?: string | null
  _count?: { products: number }
}

export interface CategoryTreeNode extends CategoryRow {
  children: CategoryTreeNode[]
}

export function fetchCategories() {
  return apiFetch<{ categories: CategoryRow[]; total: number }>('/admin/categories')
}

export function fetchCategoryTree() {
  return apiFetch<{ categories: CategoryRow[]; tree: CategoryTreeNode[]; total: number }>(
    '/admin/categories/tree',
  )
}

export function seedDefaultCategories() {
  return apiFetch<{ success: boolean; departments: number; subcategories: number; reparented: number }>(
    '/admin/categories/seed-defaults',
    { method: 'POST' },
  )
}

export function createCategory(data: {
  name: string
  description?: string
  parentId?: string
  sortOrder?: number
  image?: string
}) {
  return apiFetch<CategoryRow>('/admin/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateCategory(
  id: string,
  data: Partial<{
    name: string
    description: string
    isActive: boolean
    image: string | null
    parentId: string | null
    sortOrder: number
  }>,
) {
  return apiFetch<CategoryRow>(`/admin/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteCategory(id: string) {
  return apiFetch<{ success: boolean }>(`/admin/categories/${id}`, { method: 'DELETE' })
}

export function reorderCategories(order: { id: string; sortOrder: number }[]) {
  return apiFetch<{ updated: number }>('/admin/categories/reorder', {
    method: 'POST',
    body: JSON.stringify({ order }),
  })
}
