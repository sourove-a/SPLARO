import { apiFetch } from './client'

export interface ApiCustomer {
  id: string
  customerCode?: string | null
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
  isStaff?: boolean
  authProvider?: string
  googleLinked?: boolean
  emailVerified?: boolean
  avatar?: string | null
}

export interface CustomerFraudSignals {
  lastIp: string | null
  lastDeviceIdMasked: string | null
  lastDeviceSummary: string | null
  sameIpOrderCount: number
  sameDeviceOrderCount: number
  distinctPhonesOnDevice: number
  distinctPhonesOnIp: number
  firstSeenAt: string | null
  firstSeenAtIp?: string | null
  firstSeenAtDevice?: string | null
  lastSeenAt: string | null
  flags: string[]
  captured: boolean
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
  lastIp?: string
  fraudSignals?: CustomerFraudSignals
}

export function fetchCustomers(params?: {
  search?: string
  limit?: number
  page?: number
  staff?: 'hide' | 'include' | 'only'
  from?: string
  to?: string
}) {
  const qs = new URLSearchParams()
  if (params?.search) qs.set('search', params.search)
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.page) qs.set('page', String(params.page))
  if (params?.staff) qs.set('staff', params.staff)
  if (params?.from) qs.set('from', params.from)
  if (params?.to) qs.set('to', params.to)
  const query = qs.toString()
  return apiFetch<{
    customers: ApiCustomer[]
    total: number
    /** Rows the staff filter is holding back — 0 unless staff=hide. */
    staffHidden?: number
    page?: number
    totalPages?: number
  }>(`/admin/customers${query ? `?${query}` : ''}`)
}

export interface CustomerPresence {
  /** Customer ids on the storefront inside the presence window. */
  online: string[]
  source: 'live' | 'sessions'
  updatedAt: string
}

export function fetchCustomerPresence() {
  return apiFetch<CustomerPresence>('/admin/customers/presence')
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
  return apiFetch<{ success: boolean; ordersDeleted: number }>(`/admin/customers/${id}${qs}`, {
    method: 'DELETE',
  })
}

export interface BulkDeleteCustomersResult {
  success: boolean
  deleted: number
  ordersDeleted: number
  skipped: { id: string; name: string; reason: string }[]
}

/** Force also removes each customer's orders — used to clear fake COD accounts. */
export function bulkDeleteCustomers(ids: string[], options?: { force?: boolean }) {
  return apiFetch<BulkDeleteCustomersResult>('/admin/customers/bulk/delete', {
    method: 'POST',
    body: JSON.stringify({ ids, force: options?.force === true }),
  })
}

export function createCustomer(input: {
  firstName: string
  lastName?: string
  phone: string
  email?: string
}) {
  return apiFetch<ApiCustomer>('/admin/customers', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function mergeCustomers(keepId: string, mergeIds: string[]) {
  return apiFetch<{ ok: boolean; customer: ApiCustomer; merged: number }>('/admin/customers/merge', {
    method: 'POST',
    body: JSON.stringify({ keepId, mergeIds }),
  })
}

export function bulkAddCustomerTags(ids: string[], tags: string[]) {
  return apiFetch<{ ok: boolean; updated: number }>('/admin/customers/bulk/tags', {
    method: 'POST',
    body: JSON.stringify({ customerIds: ids, tags }),
  })
}
