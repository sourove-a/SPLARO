import { toastOk, toastFail, toastWarn } from '@/lib/admin/feedback'

const STORAGE_PREFIX = 'splaro-admin:'

export function loadAdminData<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveAdminData<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(data))
}

export function downloadBlob(filename: string, content: BlobPart, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => escapeCsvCell(cell ?? '')).join(',')).join('\n')
  downloadBlob(filename.endsWith('.csv') ? filename : `${filename}.csv`, csv, 'text/csv;charset=utf-8')
}

export function downloadJson(filename: string, data: unknown) {
  downloadBlob(
    filename.endsWith('.json') ? filename : `${filename}.json`,
    JSON.stringify(data, null, 2),
    'application/json;charset=utf-8',
  )
}

export function tableElementToRows(table: HTMLTableElement): string[][] {
  const rows: string[][] = []
  table.querySelectorAll('tr').forEach((tr) => {
    const cells = Array.from(tr.querySelectorAll('th, td'))
      .map((cell) => cell.textContent?.trim().replace(/\s+/g, ' ') ?? '')
      .filter((_, i, arr) => {
        // skip empty action columns
        if (arr.length > 1 && i === arr.length - 1 && arr[i] === '') return false
        return true
      })
    if (cells.length > 0 && cells.some((c) => c.length > 0)) rows.push(cells)
  })
  return rows
}

export function exportTableFromContainer(container: HTMLElement | null, slug: string) {
  const table = container?.querySelector('table')
  if (!table) {
    toastFail('No table data to export on this page.')
    return false
  }
  const rows = tableElementToRows(table)
  if (rows.length < 2) {
    toastFail('Nothing to export yet.')
    return false
  }
  const date = new Date().toISOString().slice(0, 10)
  const filename = `splaro-${slug}-${date}.csv`
  downloadCsv(filename, rows)
  toastOk(`Downloaded ${filename}`, 'export-csv')
  return true
}

export function downloadInvoice(orderId: string) {
  window.open(
    `/api/orders/${encodeURIComponent(orderId)}/invoice`,
    '_blank',
    'noopener,noreferrer',
  )
}

export function printInvoice(orderId: string) {
  window.open(
    `/api/orders/${encodeURIComponent(orderId)}/invoice/print`,
    '_blank',
    'noopener,noreferrer',
  )
}

export function downloadInvoicePdf(orderId: string, invoiceNumber?: string) {
  const anchor = document.createElement('a')
  anchor.href = `/api/orders/${encodeURIComponent(orderId)}/invoice/pdf`
  anchor.download = `${invoiceNumber ?? orderId}.pdf`
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

/** Verified API persistence — green only after server confirms. */
export function toastApiSaved(label: string) {
  toastOk(`${label} saved to server.`, `api-saved:${label}`)
}

/** @deprecated Local-only — never use for settings or live data. Prefer toastApiSaved after API OK. */
export function notifySaved(label: string) {
  toastWarn(`${label} saved locally only — NOT synced to API.`, `local-saved:${label}`)
}

export function saveDraftRecord(moduleHref: string, record: Record<string, unknown>) {
  const key = `draft:${moduleHref}`
  const existing = loadAdminData<Record<string, unknown>[]>(key, [])
  existing.unshift({ ...record, savedAt: new Date().toISOString() })
  saveAdminData(key, existing.slice(0, 50))
}

export function saveRecordEdit(moduleHref: string, recordId: string, record: Record<string, unknown>) {
  saveAdminData(`record:${moduleHref}:${recordId}`, { ...record, updatedAt: new Date().toISOString() })
}
