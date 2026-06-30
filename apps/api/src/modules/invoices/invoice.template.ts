import type { InvoiceViewModel } from './invoice.helpers'
import { buildInvoiceViewModel, escapeHtml, formatBdt, paymentStatusLabel, statusBadgeClass } from './invoice.helpers'

export interface InvoiceTemplateOptions {
  showToolbar?: boolean
  autoPrint?: boolean
  /** `fragment` = inner invoice only (for email embed). Default `full` document. */
  mode?: 'full' | 'fragment'
}

function itemThumb(url: string, name: string): string {
  if (!url) {
    const initial = escapeHtml(name.charAt(0).toUpperCase() || 'S')
    return `<div class="thumb thumb--empty" aria-hidden="true">${initial}</div>`
  }
  return `<div class="thumb"><img src="${escapeHtml(url)}" alt="" /></div>`
}

function itemMeta(item: InvoiceViewModel['items'][number]): string {
  const parts = [
    item.sku !== '—' ? `SKU ${item.sku}` : '',
    item.size !== '—' ? `Size ${item.size}` : '',
    item.color !== '—' ? item.color : '',
  ].filter(Boolean)
  return parts.join(' · ')
}

export function generateInvoiceHTML(
  model: InvoiceViewModel,
  options: InvoiceTemplateOptions = {},
): string {
  const showToolbar = options.showToolbar ?? model.showToolbar
  const autoPrint = options.autoPrint ?? model.autoPrint
  const fragment = options.mode === 'fragment'
  const payLabel = paymentStatusLabel(model.paymentStatusKey)
  const orderBadge = statusBadgeClass('order', model.orderStatusKey)
  const payBadge = statusBadgeClass('payment', model.paymentStatusKey)

  const itemRows = model.items
    .map((item) => {
      const meta = itemMeta(item)
      return `
      <tr>
        <td class="col-thumb">${itemThumb(item.imageUrl, item.productName)}</td>
        <td class="col-product">
          <div class="product-name">${escapeHtml(item.productName)}</div>
          ${meta ? `<div class="product-meta">${escapeHtml(meta)}</div>` : ''}
        </td>
        <td class="num col-qty"><span class="qty">${item.quantity}</span></td>
        <td class="num">${formatBdt(item.unitPrice)}</td>
        <td class="num col-total"><strong>${formatBdt(item.lineTotal)}</strong></td>
      </tr>`
    })
    .join('')

  const summaryRows = [
    { label: 'Subtotal', value: formatBdt(model.subtotal), accent: false },
    model.deliveryCharge > 0
      ? { label: 'Delivery', value: formatBdt(model.deliveryCharge), accent: false }
      : null,
    model.discount > 0
      ? {
          label: model.couponCode ? `Discount (${model.couponCode})` : 'Discount',
          value: `−${formatBdt(model.couponCode ? model.couponDiscount || model.discount : model.discount)}`,
          accent: true,
        }
      : null,
    model.advancePaid > 0 ? { label: 'Advance paid', value: `−${formatBdt(model.advancePaid)}`, accent: false } : null,
  ]
    .filter(Boolean)
    .map(
      (row) => `
      <div class="totals-row${row!.accent ? ' totals-row--accent' : ''}">
        <span>${escapeHtml(row!.label)}</span>
        <strong>${row!.value}</strong>
      </div>`,
    )
    .join('')

  const totalDue =
    model.dueAmount > 0 && model.dueAmount !== model.grandTotal
      ? model.dueAmount
      : model.grandTotal

  const courierBlock =
    model.courierPartner && model.courierPartner !== '—'
      ? `<div class="chip">
          <span class="chip__label">Courier</span>
          <strong>${escapeHtml(model.courierPartner)}</strong>
          ${model.courierTracking ? `<span class="chip__sub">Tracking ${escapeHtml(model.courierTracking)}</span>` : ''}
        </div>`
      : ''

  const noteBlock =
    model.customerNote || model.adminNote
      ? `<section class="notes">
          ${model.customerNote ? `<p><span>Note</span>${escapeHtml(model.customerNote)}</p>` : ''}
          ${model.adminNote ? `<p><span>Remarks</span>${escapeHtml(model.adminNote)}</p>` : ''}
        </section>`
      : ''

  const emailLine =
    model.customerEmail && model.customerEmail !== '—'
      ? `${escapeHtml(model.customerEmail)}<br />`
      : ''

  const styles = `
    :root {
      --ink: #111111;
      --muted: #6b6b6b;
      --gold: #c8a97e;
      --gold-soft: rgba(200, 169, 126, 0.18);
      --ivory: #faf8f5;
      --line: rgba(17, 17, 17, 0.08);
      --paper: #ffffff;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      background: var(--ivory);
      color: var(--ink);
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 11px;
      line-height: 1.55;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    @page { size: A4 portrait; margin: 12mm 14mm; }

    .toolbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      justify-content: center;
      gap: 10px;
      padding: 12px 16px;
      background: rgba(255,255,255,0.88);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--line);
    }

    .toolbar button {
      border: none;
      border-radius: 999px;
      background: var(--ink);
      color: #fff;
      cursor: pointer;
      font: 600 10px/1 Inter, sans-serif;
      letter-spacing: 0.14em;
      padding: 10px 20px;
      text-transform: uppercase;
    }

    .shell {
      max-width: 210mm;
      margin: 0 auto;
      padding: ${fragment ? '0' : '20px 16px 32px'};
    }

    .sheet {
      position: relative;
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: ${fragment ? '12px' : '4px'};
      overflow: hidden;
      box-shadow: ${fragment ? 'none' : '0 24px 64px rgba(17,17,17,0.07)'};
    }

    .sheet__accent {
      height: 4px;
      background: linear-gradient(90deg, #a88758 0%, var(--gold) 50%, #dcc9a8 100%);
    }

    .sheet__body { padding: 28px 30px 26px; }

    .head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      padding-bottom: 22px;
      margin-bottom: 22px;
      border-bottom: 1px solid var(--line);
    }

    .brand img {
      display: block;
      height: 58px;
      width: auto;
      max-width: 200px;
      object-fit: contain;
      margin-bottom: 12px;
    }

    .brand__name {
      font-family: "Cormorant Garamond", Georgia, "Times New Roman", serif;
      font-size: 26px;
      font-weight: 500;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      line-height: 1;
    }

    .brand__tagline {
      margin-top: 6px;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--gold);
    }

    .brand__office {
      margin-top: 8px;
      font-size: 10px;
      color: var(--muted);
      line-height: 1.6;
    }

    .doc {
      text-align: right;
      min-width: 200px;
    }

    .doc__label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--gold);
    }

    .doc__title {
      margin-top: 6px;
      font-family: "Cormorant Garamond", Georgia, serif;
      font-size: 34px;
      font-weight: 400;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      line-height: 1;
    }

    .doc__number {
      margin-top: 10px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.06em;
    }

    .doc__date {
      margin-top: 4px;
      font-size: 11px;
      color: var(--muted);
    }

    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 22px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .badge--paid { background: #e8f5e9; color: #2e7d32; }
    .badge--pending { background: #fff8e1; color: #e65100; }
    .badge--processing { background: #e8f0fe; color: #1a56db; }
    .badge--cancelled { background: #fce8e8; color: #b42318; }

    .grid {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 14px;
      margin-bottom: 24px;
    }

    .panel {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px 16px;
      background: linear-gradient(180deg, #fff 0%, #fcfaf7 100%);
    }

    .panel__label {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 8px;
    }

    .panel__name {
      font-family: "Cormorant Garamond", Georgia, serif;
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 6px;
    }

    .panel__text {
      font-size: 11px;
      color: var(--muted);
      line-height: 1.65;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .chip {
      padding: 10px 12px;
      border-radius: 10px;
      background: var(--ivory);
      border: 1px solid var(--line);
    }

    .chip__label {
      display: block;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 4px;
    }

    .chip strong {
      display: block;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.35;
    }

    .chip__sub {
      display: block;
      margin-top: 3px;
      font-size: 9px;
      color: var(--muted);
      word-break: break-all;
    }

    table.items {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 22px;
    }

    table.items thead th {
      padding: 10px 8px;
      border-top: 2px solid var(--ink);
      border-bottom: 1px solid var(--line);
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted);
      text-align: left;
      background: #fcfaf7;
    }

    table.items tbody td {
      padding: 12px 8px;
      border-bottom: 1px solid var(--line);
      vertical-align: middle;
    }

    table.items tbody tr:last-child td {
      border-bottom: 2px solid var(--ink);
    }

    .col-thumb { width: 58px; }
    .col-product { min-width: 0; }
    .col-qty { width: 48px; }
    .col-total { width: 88px; }
    .num { text-align: right; white-space: nowrap; }

    .thumb {
      width: 48px;
      height: 60px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--line);
      background: var(--ivory);
    }

    .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

    .thumb--empty {
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: "Cormorant Garamond", Georgia, serif;
      font-size: 20px;
      color: var(--gold);
    }

    .product-name {
      font-size: 12px;
      font-weight: 600;
      line-height: 1.35;
    }

    .product-meta {
      margin-top: 3px;
      font-size: 9px;
      color: var(--muted);
      letter-spacing: 0.02em;
    }

    .qty {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 28px;
      border-radius: 999px;
      background: var(--gold-soft);
      font-size: 11px;
      font-weight: 700;
    }

    .foot {
      display: grid;
      grid-template-columns: 1fr 280px;
      gap: 20px;
      align-items: start;
    }

    .terms {
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px dashed rgba(200, 169, 126, 0.55);
      background: rgba(200, 169, 126, 0.08);
    }

    .terms__label {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 6px;
    }

    .terms p {
      font-size: 11px;
      line-height: 1.6;
      color: var(--ink);
    }

    .totals {
      padding: 16px 18px;
      border-radius: 12px;
      background: var(--ivory);
      border: 1px solid var(--line);
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 6px 0;
      font-size: 11px;
      color: var(--muted);
    }

    .totals-row strong { color: var(--ink); font-weight: 600; }
    .totals-row--accent strong { color: #b45309; }

    .grand {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 2px solid var(--ink);
    }

    .grand span {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    .grand strong {
      font-family: "Cormorant Garamond", Georgia, serif;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .notes {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
      font-size: 10px;
      color: var(--muted);
      line-height: 1.65;
    }

    .notes p + p { margin-top: 8px; }

    .notes span {
      display: block;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 2px;
    }

    .footer {
      margin-top: 24px;
      padding-top: 18px;
      border-top: 1px solid var(--line);
      text-align: center;
    }

    .footer__thanks {
      font-family: "Cormorant Garamond", Georgia, serif;
      font-size: 15px;
      font-style: italic;
      color: var(--ink);
      margin-bottom: 10px;
      line-height: 1.5;
    }

    .footer__meta {
      font-size: 9px;
      color: var(--muted);
      line-height: 1.8;
      letter-spacing: 0.04em;
    }

    .footer__gold {
      width: 48px;
      height: 2px;
      margin: 0 auto 12px;
      background: linear-gradient(90deg, transparent, var(--gold), transparent);
    }

    @media print {
      .toolbar { display: none !important; }
      html, body { background: #fff; }
      .shell { padding: 0; max-width: none; }
      .sheet { border: none; box-shadow: none; border-radius: 0; }
      tr { break-inside: avoid; page-break-inside: avoid; }
    }

    @media (max-width: 680px) {
      .sheet__body { padding: 20px 16px; }
      .head { flex-direction: column; }
      .doc { text-align: left; }
      .grid, .foot { grid-template-columns: 1fr; }
      .meta-grid { grid-template-columns: 1fr; }
    }
  `

  const article = `
  <article class="sheet">
    <div class="sheet__accent" aria-hidden="true"></div>
    <div class="sheet__body">
      <header class="head">
        <div class="brand">
          <img src="${escapeHtml(model.logoUrl)}" alt="${escapeHtml(model.brand.name)}" />
          <div class="brand__name">${escapeHtml(model.brand.name)}</div>
          <div class="brand__tagline">${escapeHtml(model.brand.tagline)}</div>
          <div class="brand__office">${escapeHtml(model.brand.office)}</div>
        </div>
        <div class="doc">
          <div class="doc__label">Tax Invoice</div>
          <div class="doc__title">Invoice</div>
          <div class="doc__number">${escapeHtml(model.invoiceNumber)}</div>
          <div class="doc__date">${escapeHtml(model.issueDate)}</div>
        </div>
      </header>

      <div class="badges">
        <span class="${orderBadge}">${escapeHtml(model.orderStatus)}</span>
        <span class="${payBadge}">${escapeHtml(payLabel)}</span>
        <span class="badge badge--processing">${escapeHtml(model.paymentMethod)}</span>
      </div>

      <div class="grid">
        <section class="panel">
          <div class="panel__label">Bill &amp; Ship To</div>
          <div class="panel__name">${escapeHtml(model.customerName)}</div>
          <div class="panel__text">
            ${emailLine}
            ${escapeHtml(model.customerPhone)}<br />
            ${escapeHtml(model.customerAddress)}<br />
            ${model.shippingCityArea ? `${escapeHtml(model.shippingCityArea)} · ` : ''}${escapeHtml(model.deliveryArea)}
          </div>
        </section>
        <section class="panel">
          <div class="panel__label">Order Details</div>
          <div class="meta-grid">
            <div class="chip">
              <span class="chip__label">Delivery</span>
              <strong>${escapeHtml(model.estimatedDelivery)}</strong>
            </div>
            <div class="chip">
              <span class="chip__label">Items</span>
              <strong>${model.items.reduce((n, i) => n + i.quantity, 0)} pcs</strong>
            </div>
            ${courierBlock}
            <div class="chip">
              <span class="chip__label">Invoice</span>
              <strong>${escapeHtml(model.invoiceNumber)}</strong>
            </div>
          </div>
        </section>
      </div>

      <table class="items">
        <thead>
          <tr>
            <th class="col-thumb"></th>
            <th>Product</th>
            <th class="num">Qty</th>
            <th class="num">Rate</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows || '<tr><td colspan="5">No items</td></tr>'}</tbody>
      </table>

      <div class="foot">
        <section class="terms">
          <div class="terms__label">Payment Terms</div>
          <p>${escapeHtml(model.paymentTerms)}</p>
        </section>
        <section class="totals">
          ${summaryRows}
          <div class="grand">
            <span>Total Due</span>
            <strong>${formatBdt(totalDue)}</strong>
          </div>
        </section>
      </div>

      ${noteBlock}

      <footer class="footer">
        <div class="footer__gold" aria-hidden="true"></div>
        <div class="footer__thanks">${escapeHtml(model.brand.thankYouNote)}</div>
        <div class="footer__meta">
          ${escapeHtml(model.brand.supportLine)}<br />
          ${escapeHtml(model.brand.websiteDisplay)} · ${escapeHtml(model.brand.phone)} · ${escapeHtml(model.brand.email)}
        </div>
      </footer>
    </div>
  </article>`

  if (fragment) return article

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${escapeHtml(model.invoiceNumber)} — ${escapeHtml(model.brand.name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>${styles}</style>
</head>
<body>
  ${
    showToolbar
      ? `<div class="toolbar no-print"><button type="button" onclick="window.print()">Print / Save PDF</button></div>`
      : ''
  }
  <div class="shell">${article}</div>
  ${autoPrint ? '<script>window.addEventListener("load", () => setTimeout(() => window.print(), 400));</script>' : ''}
</body>
</html>`
}

export function generateInvoiceHTMLFromOrder(
  data: import('./invoice.helpers').InvoiceOrder & {
    invoiceNumber: string
    storeName?: string
    storeLogo?: string
    storeEmail?: string
    storePhone?: string
    siteUrl?: string
    customerEmail?: string | null
  },
  options?: InvoiceTemplateOptions,
): string {
  const model = buildInvoiceViewModel({
    order: data,
    storeName: data.storeName,
    storeLogo: data.storeLogo,
    storeEmail: data.storeEmail,
    storePhone: data.storePhone,
    siteUrl: data.siteUrl,
    customerEmail: data.customerEmail,
  })
  return generateInvoiceHTML(model, options)
}
