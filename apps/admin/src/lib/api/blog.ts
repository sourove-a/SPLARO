import { apiFetch } from './client'

export interface BlogCategoryRow {
  id: string
  name: string
  slug: string
  _count?: { posts: number }
}

export interface BlogPostRow {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string
  featuredImage: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED' | string
  publishedAt: string | null
  metaTitle: string | null
  metaDesc: string | null
  tags: string[]
  categoryId: string | null
  category?: { name: string; slug: string } | null
  createdAt: string
  updatedAt: string
}

export interface BlogListResponse {
  posts: BlogPostRow[]
  total: number
  page: number
  totalPages: number
}

export function fetchBlogPosts(params?: { status?: string; page?: number; limit?: number }) {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const q = qs.toString()
  return apiFetch<BlogListResponse>(`/admin/content/blog${q ? `?${q}` : ''}`)
}

export function fetchBlogPost(id: string) {
  return apiFetch<BlogPostRow>(`/admin/content/blog/${encodeURIComponent(id)}`)
}

export function createBlogPost(input: {
  title: string
  content?: string
  excerpt?: string
  status?: 'DRAFT' | 'PUBLISHED'
  categoryId?: string
  featuredImage?: string
  tags?: string[]
}) {
  return apiFetch<BlogPostRow>('/admin/content/blog', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateBlogPost(
  id: string,
  input: Partial<{
    title: string
    content: string
    excerpt: string
    status: string
    featuredImage: string
    tags: string[]
    metaTitle: string
    metaDesc: string
    categoryId: string | null
  }>,
) {
  return apiFetch<BlogPostRow>(`/admin/content/blog/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteBlogPost(id: string) {
  return apiFetch<{ deleted: boolean }>(`/admin/content/blog/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function fetchBlogCategories() {
  return apiFetch<BlogCategoryRow[]>('/admin/content/blog-categories')
}

export function createBlogCategory(name: string) {
  return apiFetch<BlogCategoryRow>('/admin/content/blog-categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function deleteBlogCategory(id: string) {
  return apiFetch<{ deleted: boolean }>(`/admin/content/blog-categories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
