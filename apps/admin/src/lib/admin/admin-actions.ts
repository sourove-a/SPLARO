import {
  fetchAdminInvoice,
  invoiceApiUrl,
  parseInvoiceError,
  type InvoiceSuffix,
} from '@/lib/api/invoice-access'
import { toastOk, toastFail, toastWarn, notifyBackendMissing } from '@/lib/admin/feedback'

export { notifyBackendMissing }

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

/**
 * Open a same-origin invoice route in a new tab.
 * Must run synchronously from a click path (before any await) or popup blockers
 * will kill it. Never put `noopener` in windowFeatures — Chrome returns null.
 */
function openInvoiceTab(orderId: string, suffix: InvoiceSuffix = ''): Window | null {
  const popup = window.open(invoiceApiUrl(orderId, suffix), '_blank')
  if (!popup) return null
  try {
    popup.opener = null
  } catch {
    /* ignore */
  }
  return popup
}

function openBlankInvoiceTab(): Window | null {
  const popup = window.open('about:blank', '_blank')
  if (!popup) return null
  try {
    popup.opener = null
  } catch {
    /* ignore */
  }
  return popup
}

function writePopupHtml(popup: Window, html: string) {
  popup.document.open()
  popup.document.write(html)
  popup.document.close()
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

export async function downloadInvoice(orderId: string): Promise<boolean> {
  // Sync open first — preserves user gesture against popup blockers.
  const popup = openInvoiceTab(orderId)
  if (!popup) {
    toastFail('Pop-up blocked — allow pop-ups to view invoice.')
    return false
  }
  toastOk('Invoice opened', 'invoice-view')
  return true
}

export async function printInvoice(orderId: string): Promise<boolean> {
  // Navigate to print route (autoPrint=true on API). Sync open = not blocked.
  const popup = openInvoiceTab(orderId, '/print')
  if (!popup) {
    toastFail('Pop-up blocked — allow pop-ups to print invoice.')
    return false
  }
  toastOk('Print dialog opening…', 'invoice-print')
  return true
}

export function printProductLabel(opts: {
  sku: string
  name: string
  price: string
  category?: string
}) {
  const safe = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>SPLARO label · ${safe(opts.sku)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; font-family: Inter, system-ui, sans-serif; color: #101114; }
    .label { width: 72mm; min-height: 48mm; padding: 14px 16px; border: 1px dashed #bbb; border-radius: 8px; }
    .brand { font-size: 9px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #888; margin: 0 0 10px; }
    .sku { font-family: ui-monospace, monospace; font-size: 20px; font-weight: 800; margin: 0 0 8px; }
    .name { font-size: 13px; font-weight: 700; line-height: 1.35; margin: 0 0 6px; }
    .meta { font-size: 11px; color: #666; margin: 0; }
    .price { margin-top: 10px; font-size: 15px; font-weight: 800; }
    @media print { body { padding: 0; } .label { border: none; } }
  </style>
</head>
<body>
  <div class="label">
    <p class="brand">SPLARO</p>
    <p class="sku">${safe(opts.sku)}</p>
    <p class="name">${safe(opts.name)}</p>
    ${opts.category ? `<p class="meta">${safe(opts.category)}</p>` : ''}
    <p class="price">${safe(opts.price)}</p>
  </div>
  <script>window.addEventListener('load', () => window.print())</script>
</body>
</html>`

  const popup = window.open('', '_blank', 'width=420,height=360')
  if (!popup) {
    toastFail('Pop-up blocked — allow pop-ups to print product label.')
    return
  }
  try {
    popup.opener = null
  } catch {
    /* ignore */
  }
  writePopupHtml(popup, html)
}

export async function downloadInvoicePdf(orderId: string, invoiceNumber?: string): Promise<boolean> {
  // Reserve a tab up-front (sync) so popup blockers can't kill the Print fallback
  // if Chrome/PDF engine is missing after the async fetch.
  const fallbackTab = openBlankInvoiceTab()
  if (fallbackTab) {
    try {
      writePopupHtml(
        fallbackTab,
        '<!doctype html><title>SPLARO invoice</title><p style="font-family:system-ui;padding:24px">Preparing PDF…</p>',
      )
    } catch {
      /* ignore */
    }
  }

  try {
    const res = await fetchAdminInvoice(orderId, '/pdf')
    if (!res.ok) {
      const message = await parseInvoiceError(res)
      if (fallbackTab) fallbackTab.location.href = invoiceApiUrl(orderId, '/print')
      else toastFail(`${message} Use the Print button (allow pop-ups).`)
      toastWarn(`${message} Opening print view — use Save as PDF.`)
      return false
    }
    const blob = await res.blob()
    const type = blob.type || ''
    if (type.includes('json') || type.includes('text/html') || !blob.size) {
      if (fallbackTab) fallbackTab.location.href = invoiceApiUrl(orderId, '/print')
      else toastFail('PDF unavailable. Use the Print button — Save as PDF.')
      toastWarn('PDF engine unavailable. Opening print view — use Save as PDF.')
      return false
    }

    const filename = `${invoiceNumber ?? orderId}.pdf`
    downloadBlob(filename, blob, 'application/pdf')
    try {
      fallbackTab?.close()
    } catch {
      /* ignore */
    }
    toastOk(`Downloaded ${filename}`, 'invoice-pdf')
    return true
  } catch {
    if (fallbackTab) {
      try {
        fallbackTab.location.href = invoiceApiUrl(orderId, '/print')
      } catch {
        /* ignore */
      }
    } else {
      toastFail('PDF failed. Use Print button — allow pop-ups.')
    }
    toastWarn('PDF download failed. Opening print view — use Save as PDF.')
    return false
  }
}
