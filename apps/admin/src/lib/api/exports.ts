import { apiFetch } from './client'

export type ExportKind = 'orders' | 'customers' | 'products'
export type ExportFormat = 'csv' | 'xlsx'

export type ExportHistoryItem = {
  id: string
  createdAt: string
  kind: string
  format: string | null
  rowCount: number
  from: string | null
  to: string | null
  triggeredBy: string
}

export function fetchExportHistory() {
  return apiFetch<{ items: ExportHistoryItem[] }>('/admin/exports/history')
}

export function logExport(body: {
  kind: ExportKind
  format: ExportFormat
  rowCount: number
  from?: string
  to?: string
}) {
  return apiFetch<{ ok: true; id: string }>('/admin/exports/log', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
