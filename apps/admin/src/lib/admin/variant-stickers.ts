import { toastFail } from '@/lib/admin/feedback'
import { code128B } from '@/lib/admin/pos-receipt'

export type VariantStickerRow = {
  name: string
  size: string
  sku?: string
  barcode?: string
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Sync open + print. Uses SKU or barcode text — no fake codes. */
export function printVariantStickers(rows: VariantStickerRow[]): boolean {
  const printable = rows
    .map((row) => {
      const code = (row.barcode || row.sku || '').trim()
      return { ...row, code }
    })
    .filter((row) => row.code)

  if (!printable.length) {
    toastFail('Type a SKU or barcode first — nothing to print.')
    return false
  }

  const popup = window.open('', '_blank', 'width=720,height=900')
  if (!popup) {
    toastFail('Pop-up blocked — allow pop-ups to print stickers.')
    return false
  }

  const cards = printable
    .map((row) => {
      const bc = code128B(row.code)
      return `<article class="card">
        <div class="name">${escapeHtml(row.name || 'SPLARO')}</div>
        <div class="size">${escapeHtml(row.size)}</div>
        <div class="bc">${bc.ok ? bc.svg : ''}</div>
        <div class="code">${escapeHtml(row.code)}</div>
      </article>`
    })
    .join('')

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>SPLARO barcodes</title>
<style>
  @page { margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 12px/1.35 system-ui, sans-serif; color: #111; }
  h1 { margin: 0 0 12px; font-size: 14px; letter-spacing: .12em; text-transform: uppercase; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
  .card { border: 1px solid #111; border-radius: 8px; padding: 10px; break-inside: avoid; text-align: center; }
  .name { font-weight: 700; font-size: 12px; }
  .size { margin: 2px 0 8px; font-size: 11px; color: #444; }
  .bc svg { max-width: 100%; height: 42px; }
  .code { margin-top: 6px; font: 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .06em; }
</style></head>
<body>
  <h1>SPLARO · variant stickers</h1>
  <div class="grid">${cards}</div>
  <script>window.onload = function(){ window.focus(); window.print(); };</script>
</body></html>`

  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  popup.location.href = url
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return true
}
