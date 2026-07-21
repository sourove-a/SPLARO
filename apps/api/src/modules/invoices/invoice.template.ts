import type { InvoiceViewModel } from './invoice.helpers'
import { buildInvoiceViewModel, escapeHtml, formatBdt, paymentStatusLabel, statusBadgeClass } from './invoice.helpers'
import { generateInvoiceEmailBody } from './invoice-email-body.template'

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
      --ink: #101114;
      --ink-soft: #1a1b1f;
      --paper: #ffffff;
      --surface: #f7f8fa;
      --surface-2: #eef0f4;
      --line: rgba(16, 17, 20, 0.09);
      --muted: #6b7280;
      --muted-soft: #9ca3af;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      background: #eceef2;
      color: var(--ink);
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 11px;
      line-height: 1.55;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    @page { size: A4 portrait; margin: 10mm 12mm; }

    .toolbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      justify-content: center;
      gap: 10px;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.92);
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
      border-radius: ${fragment ? '12px' : '6px'};
      overflow: hidden;
      box-shadow: ${fragment ? 'none' : '0 28px 72px rgba(16, 17, 20, 0.1)'};
    }

    .sheet__hero {
      position: relative;
      padding: 30px 32px 28px;
      background:
        radial-gradient(circle at 88% 0%, rgba(255, 255, 255, 0.06), transparent 34%),
        linear-gradient(135deg, #0a0a0c 0%, #101114 48%, #1a1b1f 100%);
      color: #ffffff;
      overflow: hidden;
    }

    .sheet__hero-grid {
      pointer-events: none;
      position: absolute;
      inset: 0;
      opacity: 0.35;
      background-image:
        linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
      background-size: 28px 28px;
      mask-image: linear-gradient(180deg, #000 0%, transparent 92%);
      -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 92%);
    }

    .sheet__hero-inner {
      position: relative;
      z-index: 1;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 28px;
    }

    .brand {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      min-width: 0;
    }

    .brand__logo {
      display: block;
      height: 52px;
      width: auto;
      max-width: 148px;
      object-fit: contain;
      opacity: 0.96;
      flex-shrink: 0;
    }

    .brand__name {
      font-family: "Cormorant Garamond", Georgia, "Times New Roman", serif;
      font-size: 24px;
      font-weight: 500;
      letter-spacing: 0.26em;
      text-transform: uppercase;
      line-height: 1;
    }

    .brand__tagline {
      margin-top: 6px;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.58);
    }

    .brand__office {
      margin-top: 8px;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.46);
      line-height: 1.6;
      max-width: 22rem;
    }

    .doc {
      text-align: right;
      min-width: 200px;
      flex-shrink: 0;
    }

    .doc__eyebrow {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.48);
    }

    .doc__title {
      margin-top: 8px;
      font-family: "Cormorant Garamond", Georgia, serif;
      font-size: 38px;
      font-weight: 400;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      line-height: 1;
      color: #ffffff;
    }

    .doc__number {
      margin-top: 12px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: rgba(255, 255, 255, 0.92);
    }

    .doc__date {
      margin-top: 5px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.5);
    }

    .sheet__body {
      padding: 26px 30px 28px;
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
      border: 1px solid transparent;
    }

    .badge--paid { background: #ecfdf3; color: #166534; border-color: #bbf7d0; }
    .badge--pending { background: #f8fafc; color: #475569; border-color: #e2e8f0; }
    .badge--processing { background: #eff6ff; color: #1d4ed8; border-color: #dbeafe; }
    .badge--cancelled { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
    .badge--method { background: var(--ink); color: #fff; border-color: var(--ink); }

    .grid {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 14px;
      margin-bottom: 24px;
    }

    .panel {
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 15px 16px;
      background: linear-gradient(180deg, #ffffff 0%, var(--surface) 100%);
    }

    .panel__label {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 8px;
    }

    .panel__name {
      font-family: "Cormorant Garamond", Georgia, serif;
      font-size: 19px;
      font-weight: 500;
      margin-bottom: 6px;
      color: var(--ink);
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
      border-radius: 12px;
      background: var(--surface);
      border: 1px solid var(--line);
    }

    .chip__label {
      display: block;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted-soft);
      margin-bottom: 4px;
    }

    .chip strong {
      display: block;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.35;
      color: var(--ink);
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
      padding: 11px 8px;
      border-top: 2px solid var(--ink);
      border-bottom: 1px solid var(--line);
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted);
      text-align: left;
      background: var(--surface);
    }

    table.items tbody td {
      padding: 12px 8px;
      border-bottom: 1px solid var(--line);
      vertical-align: middle;
    }

    table.items tbody tr:nth-child(even) td {
      background: rgba(247, 248, 250, 0.72);
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
      background: var(--surface);
    }

    .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

    .thumb--empty {
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: "Cormorant Garamond", Georgia, serif;
      font-size: 20px;
      color: var(--muted);
      background: var(--surface-2);
    }

    .product-name {
      font-size: 12px;
      font-weight: 600;
      line-height: 1.35;
      color: var(--ink);
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
      background: var(--ink);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
    }

    .foot {
      display: grid;
      grid-template-columns: 1fr 300px;
      gap: 20px;
      align-items: start;
    }

    .terms {
      padding: 14px 16px;
      border-radius: 14px;
      border: 1px dashed rgba(16, 17, 20, 0.14);
      background: var(--surface);
    }

    .terms__label {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 6px;
    }

    .terms p {
      font-size: 11px;
      line-height: 1.62;
      color: var(--ink);
    }

    .totals {
      padding: 16px 18px;
      border-radius: 14px;
      background: var(--surface);
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
    .totals-row--accent strong { color: var(--ink); }

    .grand {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 16px;
      margin-top: 14px;
      padding: 14px 16px;
      border-radius: 12px;
      background: var(--ink);
      color: #ffffff;
    }

    .grand span {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.58);
    }

    .grand strong {
      font-family: "Cormorant Garamond", Georgia, serif;
      font-size: 26px;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: #ffffff;
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
      color: var(--muted-soft);
      margin-bottom: 2px;
    }

    .footer {
      margin-top: 24px;
      padding-top: 18px;
      border-top: 1px solid var(--line);
      text-align: center;
    }

    .footer__rule {
      width: 56px;
      height: 1px;
      margin: 0 auto 14px;
      background: linear-gradient(90deg, transparent, var(--ink), transparent);
      opacity: 0.22;
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

    @media print {
      .toolbar { display: none !important; }
      html, body { background: #fff; }
      .shell { padding: 0; max-width: none; }
      .sheet { border: none; box-shadow: none; border-radius: 0; }
      .sheet__hero { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      tr { break-inside: avoid; page-break-inside: avoid; }
    }

    @media (max-width: 680px) {
      .sheet__hero { padding: 22px 18px 20px; }
      .sheet__hero-inner { flex-direction: column; }
      .doc { text-align: left; }
      .sheet__body { padding: 20px 16px; }
      .grid, .foot { grid-template-columns: 1fr; }
      .meta-grid { grid-template-columns: 1fr; }
      .brand { flex-direction: column; }
    }
  `

  const article = `
  <article class="sheet">
    <header class="sheet__hero">
      <div class="sheet__hero-grid" aria-hidden="true"></div>
      <div class="sheet__hero-inner">
        <div class="brand">
          <img class="brand__logo" src="${escapeHtml(model.logoUrl)}" alt="${escapeHtml(model.brand.name)}" />
          <div class="brand__copy">
            <div class="brand__name">${escapeHtml(model.brand.name)}</div>
            <div class="brand__tagline">${escapeHtml(model.brand.tagline)}</div>
            <div class="brand__office">${escapeHtml(model.brand.office)}</div>
          </div>
        </div>
        <div class="doc">
          <div class="doc__eyebrow">Tax Invoice</div>
          <div class="doc__title">Invoice</div>
          <div class="doc__number">${escapeHtml(model.invoiceNumber)}</div>
          <div class="doc__date">${escapeHtml(model.issueDate)}</div>
        </div>
      </div>
    </header>

    <div class="sheet__body">
      <div class="badges">
        <span class="${orderBadge}">${escapeHtml(model.orderStatus)}</span>
        <span class="${payBadge}">${escapeHtml(payLabel)}</span>
        <span class="badge badge--method">${escapeHtml(model.paymentMethod)}</span>
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
        <div class="footer__rule" aria-hidden="true"></div>
        <div class="footer__thanks">${escapeHtml(model.brand.thankYouNote)}</div>
        <div class="footer__meta">
          ${escapeHtml(model.brand.supportLine)}<br />
          ${escapeHtml(model.brand.websiteDisplay)} · ${escapeHtml(model.brand.phone)} · ${escapeHtml(model.brand.email)}
        </div>
      </footer>
    </div>
  </article>`

  // Email must never receive this print/PDF article — Gmail strips <style> and
  // product images explode. Prefer generateInvoiceEmailBody at call sites.
  if (fragment) return generateInvoiceEmailBody(model)

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
