import { toastFail } from '@/lib/admin/feedback'
import { code128B } from '@/lib/admin/pos-receipt'

export type VariantStickerRow = {
  name: string
  size: string
  sku?: string
  barcode?: string
  /**
   * The permanent six-digit code a customer reads out on the phone.
   *
   * Optional because a legacy row may not have one, but it is the number staff
   * are asked for most often, so when it exists it is set largest on the label —
   * a sticker carrying only a scannable SKU is useless to someone on a call.
   */
  productCode?: string | null
  /** Colour, when the product has more than one. Keeps two labels apart on a shelf. */
  colour?: string | null
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** The shape every list screen already holds, so none of them need a extra fetch. */
export type StickerProduct = {
  name: string
  sku?: string | null
  productCode?: string | null
  variants?: Array<{
    sku?: string | null
    barcode?: string | null
    size?: string | null
    color?: string | null
    colorName?: string | null
  }> | null
}

/**
 * One label per variant, because a label is stuck to a physical item and the
 * physical item is a variant — a product-level sticker would be ambiguous the
 * moment a product has two sizes.
 *
 * A product with no variants still yields one label from its own SKU, which is
 * the case for a one-off piece.
 */
export function buildStickerRows(products: StickerProduct[]): VariantStickerRow[] {
  return products.flatMap((product) => {
    const variants = product.variants ?? []
    if (variants.length === 0) {
      return [
        {
          name: product.name,
          size: '',
          ...(product.sku ? { sku: product.sku } : {}),
          productCode: product.productCode ?? null,
        },
      ]
    }
    return variants.map((variant) => ({
      name: product.name,
      size: variant.size ?? '',
      ...(variant.sku ? { sku: variant.sku } : {}),
      ...(variant.barcode ? { barcode: variant.barcode } : {}),
      productCode: product.productCode ?? null,
      colour: variant.colorName ?? variant.color ?? null,
    }))
  })
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
      const variant = [row.colour, row.size].filter(Boolean).join(' · ')
      return `<article class="card">
        <div class="name">${escapeHtml(row.name || 'SPLARO')}</div>
        ${variant ? `<div class="size">${escapeHtml(variant)}</div>` : '<div class="size"></div>'}
        <div class="bc">${bc.ok ? bc.svg : ''}</div>
        <div class="code">${escapeHtml(row.code)}</div>
        ${
          row.productCode
            ? `<div class="pcode"><span>CODE</span><b>${escapeHtml(row.productCode)}</b></div>`
            : ''
        }
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
  /* Product Code is what gets read aloud, so it is the one thing on the label
     legible across a counter. Sits under a hairline so it reads as a separate
     fact from the scannable code above it. */
  .pcode { margin-top: 7px; padding-top: 6px; border-top: 1px solid #ddd; display: flex; align-items: baseline; justify-content: center; gap: 6px; }
  .pcode span { font-size: 8px; letter-spacing: .16em; color: #666; }
  .pcode b { font: 700 17px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; }
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
