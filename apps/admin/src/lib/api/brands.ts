import { apiFetch } from './client'

export interface BrandRow {
  id: string
  name: string
  slug: string
  logo?: string | null
  vendorLabel?: string | null
  country: string
  isActive: boolean
  productCount?: number
}

export function fetchBrands() {
  return apiFetch<{ brands: BrandRow[]; total: number }>('/admin/brands')
}

export function createBrand(data: { name: string; vendorLabel?: string; country?: string; logo?: string }) {
  return apiFetch<BrandRow>('/admin/brands', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateBrand(id: string, data: Partial<{ name: string; vendorLabel: string; country: string; logo: string; isActive: boolean }>) {
  return apiFetch<BrandRow>(`/admin/brands/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}
