export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER'

export interface AdminUser {
  id: string
  email: string
  name: string
  role: AdminRole
  storeId?: string
}

export interface ApiListResponse<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}

export interface ApiErrorBody {
  error?: string
  message?: string
  statusCode?: number
}
