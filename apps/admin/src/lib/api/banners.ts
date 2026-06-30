import { apiFetch } from './client'

export interface BannerRow {
  id: string
  title?: string | null
  subtitle?: string | null
  image: string
  linkUrl?: string | null
  position: string
  isActive: boolean
}

export function fetchBanners() {
  return apiFetch<{ banners: BannerRow[]; total: number }>('/admin/banners')
}

export function createBanner(data: {
  image: string
  title?: string
  subtitle?: string
  linkUrl?: string
  position?: string
}) {
  return apiFetch<BannerRow>('/admin/banners', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
