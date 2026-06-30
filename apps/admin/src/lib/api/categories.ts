import { apiFetch } from './client'

export interface CategoryRow {
  id: string
  name: string
  slug: string
  isActive?: boolean
  _count?: { products: number }
}

export function fetchCategories() {
  return apiFetch<{ categories: CategoryRow[]; total: number }>('/admin/categories')
}

export function createCategory(name: string, description?: string) {
  return apiFetch<CategoryRow>('/admin/categories', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  })
}

export function updateCategory(id: string, data: Partial<{ name: string; description: string; isActive: boolean }>) {
  return apiFetch<CategoryRow>(`/admin/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteCategory(id: string) {
  return apiFetch<{ success: boolean }>(`/admin/categories/${id}`, { method: 'DELETE' })
}
