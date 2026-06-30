import { apiFetch } from './client'

export interface UrlRedirectRow {
  id: string
  fromPath: string
  toPath: string
  type: string
  isActive: boolean
  hits: number
  note?: string | null
  createdAt: string
  updatedAt: string
}

export function fetchRedirects() {
  return apiFetch<{ redirects: UrlRedirectRow[]; total: number }>('/admin/redirects')
}

export function createRedirect(data: {
  fromPath: string
  toPath: string
  type?: string
  isActive?: boolean
  note?: string
}) {
  return apiFetch<UrlRedirectRow>('/admin/redirects', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateRedirect(
  id: string,
  data: {
    fromPath?: string
    toPath?: string
    type?: string
    isActive?: boolean
    note?: string | null
  },
) {
  return apiFetch<UrlRedirectRow>(`/admin/redirects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteRedirect(id: string) {
  return apiFetch<{ deleted: boolean }>(`/admin/redirects/${id}`, { method: 'DELETE' })
}

export function exportRedirectsCsv(redirects: { from: string; to: string; type: string; hits: number; status: string }[]) {
  const header = 'from,to,type,hits,status'
  const rows = redirects.map((r) =>
    [r.from, r.to, r.type, String(r.hits), r.status]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(','),
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `splaro-redirects-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}
