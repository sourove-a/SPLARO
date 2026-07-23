import type { InvoiceViewModel } from './invoice.helpers'
import { buildInvoiceViewModel, escapeHtml, formatBdt } from './invoice.helpers'
import { generateInvoiceEmailBody } from './invoice-email-body.template'

export interface InvoiceTemplateOptions {
  showToolbar?: boolean
  autoPrint?: boolean
  /** `fragment` = inner invoice only (for email embed). Default `full` document. */
  mode?: 'full' | 'fragment'
}

function itemMeta(item: InvoiceViewModel['items'][number]): string {
  const parts = [
    item.size !== '—' ? item.size : '',
    item.color !== '—' ? item.color : '',
  ].filter(Boolean)
  return parts.join(' · ')
}

function itemThumb(url: string, name: string): string {
  if (!url) {
    const initial = escapeHtml(name.charAt(0).toUpperCase() || 'S')
    return `<div class="thumb thumb--empty" aria-hidden="true">${initial}</div>`
  }
  return `<div class="thumb"><img src="${escapeHtml(url)}" alt="" /></div>`
}

function premiumLogoUrl(siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, '')
  return `${base}/images/logo/splaro-logo-black-premium.png`
}

/**
 * Premium cash-memo invoice — 1 page.
 * Top: brand (logo, address, web, phone). Then customer. Then items + totals. Footer.
 */
export function generateInvoiceHTML(
  model: InvoiceViewModel,
  options: InvoiceTemplateOptions = {},
): string {
  const showToolbar = options.showToolbar ?? model.showToolbar
  const autoPrint = options.autoPrint ?? model.autoPrint
  const fragment = options.mode === 'fragment'
  const logoUrl = premiumLogoUrl(model.siteUrl)

  const itemRows = model.items
    .map((item, index) => {
      const meta = itemMeta(item)
      const no = String(index + 1).padStart(2, '0')
      return `
      <tr>
        <td class="col-no">${no}</td>
        <td class="col-thumb">${itemThumb(item.imageUrl, item.productName)}</td>
        <td class="col-product">
          <div class="product-name">${escapeHtml(item.productName)}</div>
          ${meta ? `<div class="product-meta">${escapeHtml(meta)}</div>` : ''}
        </td>
        <td class="num col-qty">${item.quantity}</td>
        <td class="num col-rate">${formatBdt(item.unitPrice)}</td>
        <td class="num col-total">${formatBdt(item.lineTotal)}</td>
      </tr>`
    })
    .join('')

  const sumLines = [
    { label: 'Subtotal', value: formatBdt(model.subtotal) },
    model.deliveryCharge > 0
      ? { label: 'Delivery charge', value: formatBdt(model.deliveryCharge) }
      : null,
    model.discount > 0
      ? {
          label: model.couponCode ? `Discount (${model.couponCode})` : 'Discount',
          value: `−${formatBdt(model.couponCode ? model.couponDiscount || model.discount : model.discount)}`,
        }
      : null,
    model.advancePaid > 0
      ? { label: 'Advance paid', value: `−${formatBdt(model.advancePaid)}` }
      : null,
  ]
    .filter(Boolean)
    .map(
      (row) => `
      <div class="sum-row">
        <span>${escapeHtml(row!.label)}</span>
        <span>${row!.value}</span>
      </div>`,
    )
    .join('')

  const totalDue =
    model.dueAmount > 0 && model.dueAmount !== model.grandTotal
      ? model.dueAmount
      : model.grandTotal

  const noteBlock =
    model.customerNote || model.adminNote
      ? `<div class="notes">
          ${model.customerNote ? `<p><em>Note</em> ${escapeHtml(model.customerNote)}</p>` : ''}
          ${model.adminNote ? `<p><em>Remarks</em> ${escapeHtml(model.adminNote)}</p>` : ''}
        </div>`
      : ''

  const emailLine =
    model.customerEmail && model.customerEmail !== '—'
      ? `<span>${escapeHtml(model.customerEmail)}</span>`
      : ''

  // Address already includes city/district — don't stack shippingCityArea again.
  // Collapse accidental newlines from stored address into one readable line.
  const addressLine = escapeHtml(model.customerAddress.replace(/\s+/g, ' ').trim())
  const zoneLine = escapeHtml(model.deliveryArea)

  const paymentTerms = escapeHtml(model.paymentTerms)
  const lineCount = model.items.length
  const memoClass = lineCount >= 4 ? 'memo memo--dense' : 'memo'

  const styles = `
    :root {
      --ink: #111111;
      --soft: #3a3733;
      --muted: #8a847a;
      --brass: #9a8b6e;
      --brass-soft: rgba(154, 139, 110, 0.35);
      --line: rgba(17, 17, 17, 0.11);
      --line-soft: rgba(17, 17, 17, 0.055);
      --paper: #fffcf7;
      --wash: #f3efe8;
      --wash-2: #f8f5ef;
      --ivory: #fffcf7;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      background:
        radial-gradient(ellipse 90% 60% at 50% -10%, #e8e2d6 0%, transparent 55%),
        linear-gradient(180deg, #d9d2c6 0%, #cfc7b9 100%);
      color: var(--ink);
      font-family: "Manrope", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 10.5px;
      line-height: 1.45;
      -webkit-font-smoothing: antialiased;
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
      padding: 12px 14px;
      background: rgba(255,252,247,0.92);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--line-soft);
    }

    .toolbar button {
      border: 1px solid var(--ink);
      background: var(--ink);
      color: var(--ivory);
      cursor: pointer;
      font: 700 9px/1 "Manrope", Inter, sans-serif;
      letter-spacing: 0.22em;
      padding: 11px 26px;
      text-transform: uppercase;
      transition: background 0.2s ease, color 0.2s ease;
    }
    .toolbar button:hover {
      background: transparent;
      color: var(--ink);
    }

    .shell {
      max-width: 548px;
      width: 100%;
      margin: 0 auto;
      padding: ${fragment ? '0' : '28px 12px 48px'};
    }

    .memo {
      position: relative;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.55) 0%, transparent 42%),
        var(--paper);
      border: 1px solid rgba(17,17,17,0.14);
      box-shadow: ${
        fragment
          ? 'none'
          : '0 1px 0 rgba(255,255,255,0.7) inset, 0 32px 72px rgba(30,24,16,0.12), 0 8px 18px rgba(30,24,16,0.06)'
      };
      overflow: hidden;
    }

    /* Inner frame + stationery corners */
    .memo__frame {
      pointer-events: none;
      position: absolute;
      inset: 7px;
      border: 1px solid rgba(17,17,17,0.06);
      z-index: 2;
    }
    .memo::before,
    .memo::after {
      content: "";
      pointer-events: none;
      position: absolute;
      width: 16px;
      height: 16px;
      border-color: rgba(17,17,17,0.28);
      border-style: solid;
      z-index: 3;
    }
    .memo::before {
      top: 11px; left: 11px;
      border-width: 1.5px 0 0 1.5px;
    }
    .memo::after {
      top: 11px; right: 11px;
      border-width: 1.5px 1.5px 0 0;
    }
    .memo__corners {
      pointer-events: none;
      position: absolute;
      inset: 0;
      z-index: 3;
    }
    .memo__corners::before,
    .memo__corners::after {
      content: "";
      position: absolute;
      width: 16px;
      height: 16px;
      border-color: rgba(17,17,17,0.28);
      border-style: solid;
    }
    .memo__corners::before {
      bottom: 11px; left: 11px;
      border-width: 0 0 1.5px 1.5px;
    }
    .memo__corners::after {
      bottom: 11px; right: 11px;
      border-width: 0 1.5px 1.5px 0;
    }

    .brand {
      position: relative;
      z-index: 1;
      text-align: center;
      padding: 28px 28px 16px;
      background:
        radial-gradient(ellipse 75% 70% at 50% 0%, rgba(255,255,255,0.95), transparent 72%);
    }

    .brand__logo {
      display: block;
      height: 42px;
      width: auto;
      max-width: 168px;
      margin: 0 auto 12px;
      object-fit: contain;
      filter: contrast(1.04);
    }

    .brand__rule {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin: 0 auto 10px;
      max-width: 200px;
    }
    .brand__rule::before,
    .brand__rule::after {
      content: "";
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--brass), transparent);
      opacity: 0.7;
    }
    .brand__diamond {
      width: 5px;
      height: 5px;
      transform: rotate(45deg);
      background: var(--brass);
      flex-shrink: 0;
      box-shadow: 0 0 0 3px rgba(154,139,110,0.12);
    }

    .brand__tagline {
      font-size: 7.5px;
      font-weight: 700;
      letter-spacing: 0.34em;
      text-transform: uppercase;
      color: var(--brass);
      margin-bottom: 9px;
    }

    .brand__office {
      font-size: 10px;
      color: var(--soft);
      margin-bottom: 3px;
      letter-spacing: 0.03em;
      font-weight: 500;
    }

    .brand__contact {
      font-size: 8px;
      color: var(--muted);
      letter-spacing: 0.06em;
      line-height: 1.5;
      font-weight: 500;
    }

    .titlebar {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: end;
      gap: 12px;
      margin: 2px 18px 0;
      padding: 12px 2px 11px;
      border-top: 1.5px solid var(--ink);
      border-bottom: 1px solid var(--ink);
      box-shadow:
        inset 0 3px 0 -2px var(--ink),
        inset 0 -3px 0 -2px rgba(17,17,17,0.35);
    }

    .titlebar__name {
      font-family: "Cormorant Garamond", Georgia, serif;
      font-size: 16px;
      font-weight: 500;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--ink);
      line-height: 1;
      padding-bottom: 1px;
    }

    .titlebar__meta {
      text-align: right;
      display: grid;
      gap: 2px;
    }

    .titlebar__meta span {
      display: block;
      font-size: 6.5px;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--brass);
    }

    .titlebar__meta strong {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--ink);
      line-height: 1.15;
    }

    .titlebar__meta em {
      font-style: normal;
      font-size: 8px;
      color: var(--muted);
      letter-spacing: 0.02em;
      font-weight: 500;
    }

    .customer {
      position: relative;
      z-index: 1;
      margin: 14px 18px 0;
      padding: 0;
      display: grid;
      grid-template-columns: 1.4fr 0.9fr;
      gap: 0;
      border: 1px solid var(--line);
      background: linear-gradient(135deg, #fff 0%, var(--wash-2) 100%);
      overflow: hidden;
    }
    .customer::before {
      content: "";
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 2px;
      background: linear-gradient(180deg, var(--brass), rgba(154,139,110,0.2));
    }

    .customer__main,
    .customer__side {
      padding: 12px 14px;
      min-width: 0;
    }

    .customer__side {
      background: rgba(243,239,232,0.55);
      border-left: 1px solid var(--line-soft);
    }

    .label {
      font-size: 6.5px;
      font-weight: 700;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--brass);
      margin-bottom: 6px;
    }

    .customer__name {
      font-family: "Cormorant Garamond", Georgia, serif;
      font-size: 17px;
      font-weight: 500;
      margin-bottom: 4px;
      letter-spacing: -0.02em;
      line-height: 1.05;
      color: var(--ink);
    }

    .customer__contact {
      font-size: 9.5px;
      color: var(--soft);
      line-height: 1.35;
      margin-bottom: 4px;
      font-weight: 500;
    }
    .customer__contact span + span::before {
      content: " · ";
      color: var(--muted);
    }

    .customer__address {
      font-size: 8.5px;
      color: var(--muted);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .customer__kv { display: grid; gap: 10px; }

    .customer__kv-row span {
      display: block;
      font-size: 6.5px;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--brass);
      margin-bottom: 3px;
    }

    .customer__kv-row strong {
      font-size: 10.5px;
      font-weight: 600;
      color: var(--ink);
      line-height: 1.25;
      letter-spacing: -0.01em;
    }

    .section-label {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 14px 18px 0;
      font-size: 6.5px;
      font-weight: 700;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--brass);
    }
    .section-label::after {
      content: "";
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, var(--brass-soft), transparent);
    }

    .items-wrap {
      position: relative;
      z-index: 1;
      padding: 6px 14px 0;
    }

    table.items {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    table.items thead th {
      padding: 8px 5px;
      border-bottom: 1.5px solid var(--ink);
      font-size: 6.5px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--muted);
      text-align: left;
      background: linear-gradient(180deg, rgba(243,239,232,0.65), transparent);
    }

    table.items tbody td {
      padding: 8px 5px;
      border-bottom: 1px solid var(--line-soft);
      vertical-align: middle;
      font-size: 10px;
    }

    table.items tbody tr:last-child td {
      border-bottom: 1.5px solid var(--ink);
    }

    .col-no {
      width: 24px;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
      font-size: 8px;
      font-weight: 600;
      letter-spacing: 0.04em;
    }
    .col-thumb { width: 42px; }
    .col-product { width: auto; }
    .col-qty { width: 34px; }
    .col-rate { width: 70px; }
    .col-total { width: 76px; }
    .num {
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      font-weight: 500;
      color: var(--soft);
    }
    .col-total.num { color: var(--ink); font-weight: 700; }

    .thumb {
      width: 34px;
      height: 42px;
      border-radius: 0;
      overflow: hidden;
      border: 1px solid var(--line);
      background: var(--wash);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.4);
    }
    .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .thumb--empty {
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: "Cormorant Garamond", Georgia, serif;
      font-size: 14px;
      color: var(--brass);
    }

    .product-name {
      font-weight: 600;
      line-height: 1.25;
      color: var(--ink);
      font-size: 10.5px;
      letter-spacing: -0.015em;
    }
    .product-meta {
      margin-top: 2px;
      font-size: 7.5px;
      color: var(--muted);
      letter-spacing: 0.04em;
      font-weight: 500;
    }

    /* 4+ lines: denser product list — chrome stays premium */
    .memo--dense table.items tbody td { padding: 5px 4px; }
    .memo--dense .thumb { width: 28px; height: 34px; }
    .memo--dense .col-thumb { width: 34px; }
    .memo--dense .product-name { font-size: 9.5px; }
    .memo--dense .brand { padding: 20px 24px 12px; }
    .memo--dense .brand__logo { height: 34px; max-width: 140px; margin-bottom: 8px; }
    .memo--dense .customer { margin-top: 10px; }
    .memo--dense .customer__main,
    .memo--dense .customer__side { padding: 9px 11px; }
    .memo--dense .customer__name { font-size: 15px; }
    .memo--dense .footer { margin-top: 10px; padding: 12px 16px 14px; }
    .memo--dense .footer__thanks { font-size: 11.5px; }

    .bottom {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: 1fr 210px;
      gap: 16px;
      align-items: end;
      padding: 12px 18px 0;
    }

    .terms .label { margin-bottom: 4px; }
    .terms p {
      font-size: 9.5px;
      color: var(--soft);
      line-height: 1.45;
      max-width: 14rem;
      font-weight: 500;
    }

    .sums {
      width: 100%;
      padding: 8px 10px 0;
      border: 1px solid var(--line-soft);
      background: linear-gradient(180deg, rgba(255,255,255,0.7), var(--wash-2));
    }

    .sum-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 4px 2px;
      font-size: 9px;
      color: var(--muted);
      font-weight: 500;
    }
    .sum-row span:last-child {
      color: var(--ink);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .grand {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 10px;
      margin: 6px -10px 0;
      padding: 11px 12px;
      background: linear-gradient(135deg, #161616 0%, #2a2723 100%);
      color: var(--ivory);
      box-shadow: inset 0 1px 0 rgba(154,139,110,0.35);
    }
    .grand span:first-child {
      font-size: 6.5px;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: rgba(255,252,247,0.45);
    }
    .grand span:last-child {
      font-family: "Cormorant Garamond", Georgia, serif;
      font-size: 19px;
      font-weight: 500;
      line-height: 1;
      letter-spacing: 0.02em;
    }

    .notes {
      position: relative;
      z-index: 1;
      padding: 8px 18px 0;
      font-size: 8px;
      color: var(--muted);
      line-height: 1.45;
    }
    .notes em {
      font-style: normal;
      font-size: 6px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin-right: 5px;
      color: var(--brass);
    }

    .footer {
      position: relative;
      z-index: 1;
      margin-top: 14px;
      padding: 14px 22px 16px;
      border-top: 1px solid var(--line);
      text-align: center;
      background:
        linear-gradient(180deg, transparent, rgba(243,239,232,0.5));
    }

    .footer__ornament {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 0 auto 10px;
      max-width: 96px;
    }
    .footer__ornament::before,
    .footer__ornament::after {
      content: "";
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--brass), transparent);
      opacity: 0.55;
    }
    .footer__ornament span {
      width: 4px;
      height: 4px;
      transform: rotate(45deg);
      background: var(--brass);
      opacity: 0.75;
    }

    .footer__thanks {
      font-family: "Cormorant Garamond", Georgia, serif;
      font-size: 13px;
      font-style: italic;
      color: var(--soft);
      line-height: 1.4;
      margin-bottom: 6px;
      max-width: 26rem;
      margin-left: auto;
      margin-right: auto;
    }

    .footer__meta {
      font-size: 6.5px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--muted);
      line-height: 1.55;
      font-weight: 600;
    }

    @media print {
      .toolbar { display: none !important; }
      @page { size: A4 portrait; margin: 10mm 12mm; }
      html, body {
        background: #fff !important;
      }
      .shell { max-width: 170mm; margin: 0 auto; padding: 0; }
      .memo {
        border: 1px solid rgba(17,17,17,0.16);
        box-shadow: none;
      }
      .memo__frame { inset: 5px; }
      .brand { padding: 18px 20px 12px; }
      .brand__logo { height: 36px; max-width: 148px; }
      .titlebar { margin: 0 14px; padding: 9px 2px; }
      .customer { margin: 10px 14px 0; }
      .section-label { margin: 11px 14px 0; }
      .items-wrap { padding: 4px 10px 0; }
      .bottom { padding: 10px 14px 0; gap: 12px; }
      .footer { padding: 12px 16px 14px; margin-top: 12px; }

      .memo--dense .col-thumb,
      .memo--dense th.col-thumb { display: none !important; }
      .memo--dense table.items tbody td { padding: 4px 3px; }

      tr, .brand, .customer, .bottom, .footer, .grand {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      table.items tbody tr {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }

    @media (max-width: 560px) {
      .shell { padding: 12px 8px 28px; }
      .titlebar { margin: 0 12px; grid-template-columns: 1fr; gap: 8px; }
      .titlebar__meta { text-align: left; }
      .customer { margin: 12px 12px 0; grid-template-columns: 1fr; }
      .customer__side {
        border-left: 0;
        border-top: 1px solid var(--line-soft);
      }
      .customer__kv {
        grid-template-columns: 1fr 1fr;
        gap: 8px 12px;
        display: grid;
      }
      .bottom { grid-template-columns: 1fr; gap: 12px; }
      .sums { max-width: 260px; margin-left: auto; }
    }
  `

  const article = `
  <article class="${memoClass}">
    <div class="memo__frame" aria-hidden="true"></div>
    <div class="memo__corners" aria-hidden="true"></div>
    <header class="brand">
      <img class="brand__logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(model.brand.name)}" />
      <div class="brand__rule" aria-hidden="true"><span class="brand__diamond"></span></div>
      <div class="brand__tagline">${escapeHtml(model.brand.tagline)}</div>
      <div class="brand__office">${escapeHtml(model.brand.office)}</div>
      <div class="brand__contact">
        ${escapeHtml(model.brand.websiteDisplay)} · ${escapeHtml(model.brand.phone)} · ${escapeHtml(model.brand.email)}
      </div>
    </header>

    <div class="titlebar">
      <div class="titlebar__name">Cash Memo</div>
      <div class="titlebar__meta">
        <span>Invoice</span>
        <strong>${escapeHtml(model.invoiceNumber)}</strong>
        <em>${escapeHtml(model.issueDate)}</em>
      </div>
    </div>

    <section class="customer">
      <div class="customer__main">
        <div class="label">Customer</div>
        <div class="customer__name">${escapeHtml(model.customerName)}</div>
        <div class="customer__contact">
          <span>${escapeHtml(model.customerPhone)}</span>${emailLine}
        </div>
        <div class="customer__address">${addressLine}</div>
      </div>
      <aside class="customer__side">
        <div class="customer__kv">
          <div class="customer__kv-row">
            <span>Payment</span>
            <strong>${escapeHtml(model.paymentMethod)}</strong>
          </div>
          <div class="customer__kv-row">
            <span>Zone</span>
            <strong>${zoneLine}</strong>
          </div>
        </div>
      </aside>
    </section>

    <div class="section-label">Items</div>
    <div class="items-wrap">
      <table class="items">
        <thead>
          <tr>
            <th class="col-no">No</th>
            <th class="col-thumb"></th>
            <th>Product</th>
            <th class="num col-qty">Qty</th>
            <th class="num col-rate">Price</th>
            <th class="num col-total">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows || '<tr><td colspan="6">No items</td></tr>'}</tbody>
      </table>
    </div>

    <div class="bottom">
      <div class="terms">
        <div class="label">Payment terms</div>
        <p>${paymentTerms}</p>
      </div>
      <div class="sums">
        ${sumLines}
        <div class="grand">
          <span>Total due</span>
          <span>${formatBdt(totalDue)}</span>
        </div>
      </div>
    </div>

    ${noteBlock}

    <footer class="footer">
      <div class="footer__ornament" aria-hidden="true"><span></span></div>
      <div class="footer__thanks">${escapeHtml(model.brand.thankYouNote)}</div>
      <div class="footer__meta">
        ${escapeHtml(model.brand.supportLine)} · ${escapeHtml(model.brand.websiteDisplay)}
      </div>
    </footer>
  </article>`

  if (fragment) return generateInvoiceEmailBody(model)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cash Memo ${escapeHtml(model.invoiceNumber)} — ${escapeHtml(model.brand.name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
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
