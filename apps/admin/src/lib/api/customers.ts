import { apiFetch } from './client'

export interface ApiCustomer {
  id: string
  firstName: string
  lastName: string
  phone: string
  email: string | null
  loyaltyTier: string
  loyaltyPoints?: number
  totalOrders: number
  totalSpent: string | number
  avgOrderValue?: string | number
  codRiskScore: number
  vipScore?: number
  tags?: string[]
  adminNotes?: string | null
  createdAt: string
  lastOrderDate?: string | null
  isBlocked?: boolean
  authProvider?: string
  googleLinked?: boolean
  emailVerified?: boolean
  avatar?: string | null
}

export interface ApiCustomerDetail extends ApiCustomer {
  addresses: Array<{
    id: string
    label?: string | null
    city: string
    district: string
    division: string
  }>
  orders: Array<{
    id: string
    invoiceNumber: string
    total: string | number
    status: string
    paymentMethod?: string
    createdAt: string
  }>
  customerNotes: Array<{ id: string; body: string; createdAt: string }>
  isBlocked?: boolean
  authProvider?: string
  googleLinked?: boolean
  emailVerified?: boolean
  avatar?: string | null
  lastLogin?: string
  lastDevice?: string
}

export function fetchCustomers(params?: { search?: string; limit?: number }) {
  const qs = new URLSearchParams()
  if (params?.search) qs.set('search', params.search)
  if (params?.limit) qs.set('limit', String(params.limit))
  const query = qs.toString()
  return apiFetch<{ customers: ApiCustomer[]; total: number }>(
    `/admin/customers${query ? `?${query}` : ''}`,
  )
}

export function fetchCustomer(id: string) {
  return apiFetch<ApiCustomerDetail>(`/admin/customers/${id}`)
}

export function addCustomerNote(id: string, content: string, createdBy = 'admin') {
  return apiFetch(`/admin/customers/${id}/notes`, {
    method: 'POST',
    body: JSON.stringify({ content, createdBy }),
  })
}

export function updateCustomerTags(id: string, tags: string[]) {
  return apiFetch(`/admin/customers/${id}/tags`, {
    method: 'PATCH',
    body: JSON.stringify({ tags }),
  })
}

export function blockCustomer(id: string, blocked: boolean) {
  return apiFetch<{ success: boolean; blocked: boolean }>(`/admin/customers/${id}/block`, {
    method: 'PATCH',
    body: JSON.stringify({ blocked }),
  })
}

export function deleteCustomer(id: string, options?: { force?: boolean }) {
  const qs = options?.force ? '?force=true' : ''
  return apiFetch<{ success: boolean }>(`/admin/customers/${id}${qs}`, { method: 'DELETE' })
}
