import { barcodeBlock, escapeLabelHtml } from './barcode.util'

export interface ShippingLabelItem {
  productName: string
  sku: string
  size: string
  color: string
  quantity: number
}

export interface ShippingLabelModel {
  brandName: string
  invoiceNumber: string
  trackingCode: string
  consignmentId: string
  courierProvider: string
  customerName: string
  customerPhone: string
  fullAddress: string
  codAmount: number
  isCod: boolean
  paymentMethod: string
  items: ShippingLabelItem[]
  autoPrint: boolean
}

export interface ProductStickerModel {
  invoiceNumber: string
  productName: string
  sku: string
  /** Variant/product barcode when present — shown on the sticker. */
  barcode?: string
  /** Value encoded in the barcode (barcode → SKU → invoice fallback). */
  scanCode?: string
  size: string
  color: string
  quantity: number
  autoPrint: boolean
}

function formatBdt(amount: number): string {
  return `৳${amount.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`
}

function itemsSummary(items: ShippingLabelItem[]): string {
  return items
    .map((item) => {
      const meta = [item.size !== '—' ? item.size : '', item.color !== '—' ? item.color : '']
        .filter(Boolean)
        .join('/')
      const sku = item.sku !== '—' ? ` (${item.sku})` : ''
      return `${item.quantity}× ${item.productName}${meta ? ` · ${meta}` : ''}${sku}`
    })
    .join('<br/>')
}

/**
 * 4×6 inch thermal shipping label — courier parcel exterior.
 * Browser print dialog: paper size 4×6 / 100×150mm, margins none.
 */
export function generateShippingLabelHtml(model: ShippingLabelModel): string {
  const tracking = model.trackingCode.trim() || model.consignmentId.trim()
  const booked = Boolean(tracking)
  const codLine = model.isCod
    ? `<div class="cod"><span>COD</span><strong>${formatBdt(model.codAmount)}</strong></div>`
    : `<div class="cod cod--paid"><span>PAYMENT</span><strong>PAID · ${escapeLabelHtml(model.paymentMethod)}</strong></div>`

  const trackingBlock = booked
    ? `<div class="track">
        <div class="track__label">TRACKING</div>
        <div class="track__code">${escapeLabelHtml(tracking)}</div>
        ${barcodeBlock(tracking, 'barcode barcode--track', 8)}
        ${model.courierProvider ? `<div class="track__provider">${escapeLabelHtml(model.courierProvider)}</div>` : ''}
      </div>`
    : `<div class="track track--pending">
        <div class="track__label">TRACKING</div>
        <div class="track__code">NOT BOOKED</div>
        <p class="track__hint">Book courier, then reprint label</p>
      </div>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Label · ${escapeLabelHtml(model.invoiceNumber)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: 4in 6in; margin: 0; }
    html, body { width: 4in; height: 6in; }
    body {
      font-family: Inter, system-ui, -apple-system, sans-serif;
      color: #0a0a0a;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .label {
      width: 4in;
      height: 6in;
      padding: 0.18in 0.2in 0.16in;
      display: flex;
      flex-direction: column;
      gap: 0.1in;
      overflow: hidden;
    }
    .brand {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      border-bottom: 2.5px solid #0a0a0a;
      padding-bottom: 0.06in;
    }
    .brand__name {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0.14em;
    }
    .brand__tag {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #444;
    }
    .order-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.1in;
    }
    .order-id {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.04em;
    }
    .barcode { width: 100%; line-height: 0; }
    .barcode svg { width: 100%; height: auto; max-height: 0.55in; }
    .barcode--track svg { max-height: 0.42in; }
    .barcode--fallback {
      padding: 4px 0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
    }
    .ship-to .label-k {
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.1em;
      color: #555;
      margin-bottom: 2px;
    }
    .ship-to .name {
      font-size: 14px;
      font-weight: 900;
      line-height: 1.2;
    }
    .ship-to .phone {
      font-size: 12px;
      font-weight: 700;
      margin-top: 2px;
    }
    .ship-to .addr {
      font-size: 11px;
      font-weight: 600;
      line-height: 1.35;
      margin-top: 4px;
    }
    .cod {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.08in 0.1in;
      border: 2px solid #0a0a0a;
      background: #0a0a0a;
      color: #fff;
    }
    .cod span { font-size: 9px; font-weight: 800; letter-spacing: 0.12em; }
    .cod strong { font-size: 18px; font-weight: 900; }
    .cod--paid { background: #fff; color: #0a0a0a; }
    .track {
      border: 1.5px solid #0a0a0a;
      padding: 0.08in 0.1in;
      text-align: center;
    }
    .track__label { font-size: 8px; font-weight: 800; letter-spacing: 0.12em; color: #555; }
    .track__code { font-size: 13px; font-weight: 900; margin: 2px 0 4px; letter-spacing: 0.03em; }
    .track__provider { font-size: 8px; font-weight: 700; color: #555; margin-top: 2px; text-transform: uppercase; }
    .track--pending { border-style: dashed; }
    .track__hint { font-size: 8px; color: #777; margin-top: 2px; }
    .items {
      flex: 1;
      font-size: 9.5px;
      font-weight: 600;
      line-height: 1.4;
      border-top: 1px solid #ccc;
      padding-top: 0.06in;
      overflow: hidden;
    }
    .items__k {
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.1em;
      color: #555;
      margin-bottom: 2px;
    }
    .toolbar {
      position: fixed; top: 12px; right: 12px; z-index: 20;
      display: flex; gap: 8px;
    }
    .toolbar button {
      border: 1px solid #111; background: #111; color: #fff;
      border-radius: 8px; padding: 8px 14px; font-weight: 700; cursor: pointer;
    }
    @media print {
      .toolbar { display: none !important; }
      html, body, .label { width: 4in; height: 6in; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" onclick="window.print()">Print label</button>
  </div>
  <article class="label">
    <header class="brand">
      <span class="brand__name">${escapeLabelHtml(model.brandName)}</span>
      <span class="brand__tag">Shipping label</span>
    </header>

    <div class="order-row">
      <div class="order-id">Order: ${escapeLabelHtml(model.invoiceNumber)}</div>
    </div>
    ${barcodeBlock(model.invoiceNumber, 'barcode barcode--order', 10)}

    <section class="ship-to">
      <div class="label-k">SHIP TO</div>
      <div class="name">${escapeLabelHtml(model.customerName)}</div>
      <div class="phone">${escapeLabelHtml(model.customerPhone)}</div>
      <div class="addr">${escapeLabelHtml(model.fullAddress)}</div>
    </section>

    ${codLine}
    ${trackingBlock}

    <section class="items">
      <div class="items__k">PRODUCTS</div>
      ${itemsSummary(model.items)}
    </section>
  </article>
  ${model.autoPrint ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),180));</script>' : ''}
</body>
</html>`
}

/**
 * Small product/order stickers — one page per line item for inner packaging.
 */
export function generateProductStickersHtml(stickers: ProductStickerModel[], autoPrint: boolean): string {
  const pages = stickers
    .map((s) => {
      const meta = [s.size !== '—' ? s.size : '', s.color !== '—' ? s.color : '']
        .filter(Boolean)
        .join(' · ')
      const scanCode = (s.scanCode || s.barcode || (s.sku !== '—' ? s.sku : s.invoiceNumber)).trim()
      return `<article class="sticker">
        <div class="sticker__brand">SPLARO</div>
        <div class="sticker__order">${escapeLabelHtml(s.invoiceNumber)}</div>
        ${barcodeBlock(scanCode, 'barcode', 8)}
        <div class="sticker__name">${escapeLabelHtml(s.productName)}</div>
        <div class="sticker__meta">
          <span>SKU: ${escapeLabelHtml(s.sku)}</span>
          ${s.barcode ? `<span>BC: ${escapeLabelHtml(s.barcode)}</span>` : ''}
          ${meta ? `<span>${escapeLabelHtml(meta)}</span>` : ''}
          <span>Qty: ${s.quantity}</span>
        </div>
      </article>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Product stickers · ${escapeLabelHtml(stickers[0]?.invoiceNumber ?? 'SPLARO')}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: 62mm 40mm; margin: 0; }
    body {
      font-family: Inter, system-ui, sans-serif;
      color: #0a0a0a;
      background: #fff;
    }
    .sticker {
      width: 62mm;
      height: 40mm;
      padding: 3mm 3.5mm;
      page-break-after: always;
      break-after: page;
      display: flex;
      flex-direction: column;
      gap: 1.5mm;
      overflow: hidden;
    }
    .sticker:last-child { page-break-after: auto; }
    .sticker__brand { font-size: 9px; font-weight: 900; letter-spacing: 0.14em; }
    .sticker__order { font-size: 12px; font-weight: 900; }
    .barcode { width: 100%; line-height: 0; }
    .barcode svg { width: 100%; height: auto; max-height: 12mm; }
    .sticker__name {
      font-size: 10px; font-weight: 800; line-height: 1.25;
      overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }
    .sticker__meta {
      display: flex; flex-wrap: wrap; gap: 2mm 4mm;
      font-size: 8px; font-weight: 700; color: #333;
    }
    .toolbar {
      position: fixed; top: 12px; right: 12px; z-index: 20;
    }
    .toolbar button {
      border: 1px solid #111; background: #111; color: #fff;
      border-radius: 8px; padding: 8px 14px; font-weight: 700; cursor: pointer;
    }
    @media print { .toolbar { display: none !important; } }
  </style>
</head>
<body>
  <div class="toolbar"><button type="button" onclick="window.print()">Print stickers</button></div>
  ${pages || '<p style="padding:24px">No line items on this order.</p>'}
  ${autoPrint ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),180));</script>' : ''}
</body>
</html>`
}

/** Bulk 4×6 labels — one page per order. */
export function generateBulkShippingLabelsHtml(models: ShippingLabelModel[], autoPrint: boolean): string {
  const extracted = models
    .map((m) => {
      const html = generateShippingLabelHtml({ ...m, autoPrint: false })
      const match = html.match(/<article class="label">[\s\S]*?<\/article>/)
      return match ? `<div class="sheet">${match[0]}</div>` : null
    })
  const sheets = extracted.filter(Boolean).join('\n')
  const dropped = models.length - extracted.filter(Boolean).length
  const notice =
    dropped > 0
      ? `<p class="bulk-notice" style="padding:16px;font-family:system-ui;font-size:13px;font-weight:700;color:#b45309;background:#fffbeb;border-bottom:1px solid #f59e0b">
          Warning: ${dropped} of ${models.length} label(s) could not be rendered and were skipped.
        </p>`
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Bulk shipping labels · SPLARO</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: 4in 6in; margin: 0; }
    body { font-family: Inter, system-ui, sans-serif; color: #0a0a0a; background: #fff; }
    .sheet {
      width: 4in; height: 6in;
      page-break-after: always; break-after: page;
      overflow: hidden;
    }
    .sheet:last-child { page-break-after: auto; }
    .label {
      width: 4in; height: 6in;
      padding: 0.18in 0.2in 0.16in;
      display: flex; flex-direction: column; gap: 0.1in; overflow: hidden;
    }
    .brand { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 2.5px solid #0a0a0a; padding-bottom: 0.06in; }
    .brand__name { font-size: 18px; font-weight: 900; letter-spacing: 0.14em; }
    .brand__tag { font-size: 8px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #444; }
    .order-id { font-size: 16px; font-weight: 900; letter-spacing: 0.04em; }
    .barcode { width: 100%; line-height: 0; }
    .barcode svg { width: 100%; height: auto; max-height: 0.55in; }
    .barcode--track svg { max-height: 0.42in; }
    .ship-to .label-k { font-size: 8px; font-weight: 800; letter-spacing: 0.1em; color: #555; margin-bottom: 2px; }
    .ship-to .name { font-size: 14px; font-weight: 900; }
    .ship-to .phone { font-size: 12px; font-weight: 700; margin-top: 2px; }
    .ship-to .addr { font-size: 11px; font-weight: 600; line-height: 1.35; margin-top: 4px; }
    .cod { display: flex; align-items: center; justify-content: space-between; padding: 0.08in 0.1in; border: 2px solid #0a0a0a; background: #0a0a0a; color: #fff; }
    .cod span { font-size: 9px; font-weight: 800; letter-spacing: 0.12em; }
    .cod strong { font-size: 18px; font-weight: 900; }
    .cod--paid { background: #fff; color: #0a0a0a; }
    .track { border: 1.5px solid #0a0a0a; padding: 0.08in 0.1in; text-align: center; }
    .track__label { font-size: 8px; font-weight: 800; letter-spacing: 0.12em; color: #555; }
    .track__code { font-size: 13px; font-weight: 900; margin: 2px 0 4px; }
    .track__provider { font-size: 8px; font-weight: 700; color: #555; margin-top: 2px; text-transform: uppercase; }
    .track--pending { border-style: dashed; }
    .track__hint { font-size: 8px; color: #777; margin-top: 2px; }
    .items { flex: 1; font-size: 9.5px; font-weight: 600; line-height: 1.4; border-top: 1px solid #ccc; padding-top: 0.06in; overflow: hidden; }
    .items__k { font-size: 8px; font-weight: 800; letter-spacing: 0.1em; color: #555; margin-bottom: 2px; }
    .toolbar { position: fixed; top: 12px; right: 12px; z-index: 20; }
    .toolbar button { border: 1px solid #111; background: #111; color: #fff; border-radius: 8px; padding: 8px 14px; font-weight: 700; cursor: pointer; }
    @media print { .toolbar, .bulk-notice { display: none !important; } }
  </style>
</head>
<body>
  ${notice}
  <div class="toolbar"><button type="button" onclick="window.print()">Print all labels</button></div>
  ${sheets || '<p style="padding:24px">No orders selected.</p>'}
  ${autoPrint ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),220));</script>' : ''}
</body>
</html>`
}
