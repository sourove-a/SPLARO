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

export function fetchBanners(position?: string) {
  const qs = position ? `?position=${encodeURIComponent(position)}` : ''
  return apiFetch<{ banners: BannerRow[]; total: number }>(`/admin/banners${qs}`)
}

export function createBanner(data: {
  image: string
  title?: string
  subtitle?: string
  linkUrl?: string
  position?: string
  isActive?: boolean
  sortOrder?: number
}) {
  return apiFetch<BannerRow>('/admin/banners', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateBanner(
  id: string,
  data: {
    title?: string
    subtitle?: string
    linkUrl?: string
    isActive?: boolean
    sortOrder?: number
    position?: string
    image?: string
  },
) {
  return apiFetch<BannerRow>(`/admin/banners/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteBanner(id: string) {
  return apiFetch<{ deleted: boolean }>(`/admin/banners/${id}`, { method: 'DELETE' })
}
