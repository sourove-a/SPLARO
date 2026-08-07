import { toastFail } from '@/lib/admin/feedback'

export interface PosReceiptInput {
  invoiceNumber: string
  total: number
  paymentMethod: string
  items: { id: string; name: string; variant: string | null; quantity: number; price: number }[]
  customerName?: string | null
  customerPhone?: string | null
}

/** Lakh/crore grouping, matching the rest of the admin. */
function taka(amount: number): string {
  return `৳${Math.round(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Code 128 (subset B) as inline SVG.
 *
 * Drawn rather than pulled from a font or CDN: thermal printers rasterise what
 * the browser paints, and a missing webfont would silently print a blank strip.
 */
export function code128B(value: string): { svg: string; ok: boolean } {
  const PATTERNS = [
    '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
    '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
    '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
    '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
    '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
    '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
    '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
    '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
    '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
    '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
    '114131','311141','411131','211412','211214','211232','2331112',
  ]
  const START_B = 104
  const STOP = 106

  const codes: number[] = [START_B]
  for (const ch of value) {
    const code = ch.charCodeAt(0)
    // Subset B covers ASCII 32..126; anything else cannot be encoded.
    if (code < 32 || code > 126) return { svg: '', ok: false }
    codes.push(code - 32)
  }

  let checksum = START_B
  for (let i = 1; i < codes.length; i += 1) checksum += codes[i]! * i
  codes.push(checksum % 103, STOP)

  const MODULE = 2
  const HEIGHT = 54
  let x = 0
  let bars = ''
  for (const code of codes) {
    const pattern = PATTERNS[code]
    if (!pattern) return { svg: '', ok: false }
    let dark = true
    for (const widthChar of pattern) {
      const w = Number(widthChar) * MODULE
      if (dark) bars += `<rect x="${x}" y="0" width="${w}" height="${HEIGHT}" fill="#000"/>`
      x += w
      dark = !dark
    }
  }

  return {
    ok: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${HEIGHT}" viewBox="0 0 ${x} ${HEIGHT}" role="img" aria-label="${escapeHtml(value)}">${bars}</svg>`,
  }
}

/**
 * Opens an 80mm thermal receipt in a new tab and triggers print.
 *
 * The window is opened synchronously from the click so pop-up blockers do not
 * eat it, and the document is fully self-contained — no network fetch, so a slow
 * or offline counter still prints.
 */
export function printPosReceipt(input: PosReceiptInput): boolean {
  const popup = window.open('', '_blank', 'noopener,width=380,height=640')
  if (!popup) {
    toastFail('Pop-up blocked — allow pop-ups to print the receipt.', 'pos-receipt-popup')
    return false
  }

  const barcode = code128B(input.invoiceNumber)
  const rows = input.items
    .map(
      (item) => `
        <tr>
          <td>
            ${escapeHtml(item.name)}
            ${item.variant ? `<span class="v">${escapeHtml(item.variant)}</span>` : ''}
          </td>
          <td class="n">${item.quantity}</td>
          <td class="n">${taka(item.price * item.quantity)}</td>
        </tr>`,
    )
    .join('')

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(input.invoiceNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; color: #000; }
  h1 { margin: 0; font-size: 15px; letter-spacing: .18em; text-align: center; }
  .sub { margin: 2px 0 10px; text-align: center; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 0; vertical-align: top; }
  .n { text-align: right; white-space: nowrap; }
  .v { display: block; font-size: 9.5px; color: #444; }
  .rule { border-top: 1px dashed #000; margin: 8px 0; }
  .tot { display: flex; justify-content: space-between; font-weight: 700; font-size: 14px; }
  .meta { font-size: 10px; margin-top: 2px; }
  .bc { text-align: center; margin-top: 12px; }
  .bc .num { font-size: 10px; letter-spacing: .12em; margin-top: 3px; }
  .foot { margin-top: 12px; text-align: center; font-size: 10px; }
</style></head>
<body>
  <h1>SPLARO</h1>
  <p class="sub">Counter sale · ${escapeHtml(input.invoiceNumber)}</p>
  <div class="rule"></div>
  <table>${rows}</table>
  <div class="rule"></div>
  <div class="tot"><span>TOTAL</span><span>${taka(input.total)}</span></div>
  <p class="meta">Payment: ${escapeHtml(input.paymentMethod)}</p>
  ${input.customerName ? `<p class="meta">Customer: ${escapeHtml(input.customerName)}</p>` : ''}
  ${input.customerPhone ? `<p class="meta">Phone: ${escapeHtml(input.customerPhone)}</p>` : ''}
  <p class="meta">${new Date().toLocaleString('en-BD')}</p>
  <div class="bc">
    ${barcode.ok ? barcode.svg : ''}
    <div class="num">${escapeHtml(input.invoiceNumber)}</div>
  </div>
  <p class="foot">Thank you — no return without this receipt.</p>
  <script>window.onload = function(){ window.focus(); window.print(); };</script>
</body></html>`

  // Blob URL rather than document.write: same result, but nothing is parsed
  // into an existing document. Every interpolation above is escaped, and the
  // barcode is generated rects, so no caller data reaches the markup raw.
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  popup.location.href = url
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return true
}
