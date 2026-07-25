import { SPLARO_INVOICE_BRAND, buildInvoiceBrandHeader } from '@splaro/config'
import { fetchOrderByIdViaApi, fetchOrdersViaApi } from '@/lib/server/api-orders'
import {
  readOrders,
  writeOrders,
  type StoredOrder,
  type StoredOrderItem,
} from '@/lib/server/store'

/**
 * Orders are owned by the SPLARO API/database. The legacy file-store order
 * creation path (createOrder/validateStock/decrementStock) has been removed —
 * production checkout goes through createOrderViaApi only.
 *
 * A local JSON file cache exists ONLY for offline dev convenience and is
 * disabled unless SPLARO_DEV_FILE_ORDER_CACHE=1 (never in production).
 */
const fileCacheEnabled = () =>
  process.env.SPLARO_DEV_FILE_ORDER_CACHE === '1' && process.env.NODE_ENV !== 'production'

/** Dev-only mirror of API-created orders — no-op unless explicitly enabled. */
export async function cacheOrderInFile(order: StoredOrder): Promise<void> {
  if (!fileCacheEnabled()) return
  const orders = await readOrders()
  const index = orders.findIndex(
    (entry) => entry.id === order.id || entry.invoiceNumber === order.invoiceNumber,
  )
  if (index >= 0) {
    orders[index] = { ...orders[index], ...order }
  } else {
    orders.unshift(order)
  }
  await writeOrders(orders)
}

export interface ResolveOrderOptions {
  accessKey?: string | null | undefined
  phone?: string | null | undefined
}

/** API-first order lookup; dev file cache consulted only when enabled. */
export async function resolveOrderById(
  id: string,
  options?: ResolveOrderOptions,
): Promise<StoredOrder | null> {
  const remote = await fetchOrderByIdViaApi(id, options)
  if (remote) return remote

  if (fileCacheEnabled()) {
    const orders = await readOrders()
    return (
      orders.find((order) => order.id === id || order.invoiceNumber === id) ?? null
    )
  }
  return null
}

/** API-only phone lookup — never merges stale file-cache rows into results. */
export async function getOrdersByPhone(phone: string): Promise<StoredOrder[]> {
  const remote = await fetchOrdersViaApi(phone)
  return [...remote].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

function escapeInvoiceHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  'Cash on Delivery': 'Cash on Delivery',
  CASH_ON_DELIVERY: 'Cash on Delivery',
  BKASH: 'bKash',
  NAGAD: 'Nagad',
  SSLCommerz: 'SSLCommerz',
  SSLCOMMERZ: 'SSLCommerz',
}

function formatPaymentMethod(method: string): string {
  const trimmed = method.trim()
  if (PAYMENT_METHOD_LABELS[trimmed]) return PAYMENT_METHOD_LABELS[trimmed]
  return trimmed.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatPaymentStatus(status: string): string {
  const normalized = status.trim().toLowerCase()
  if (normalized === 'paid') return 'Paid'
  if (normalized === 'pending') return 'Pending'
  if (normalized === 'failed') return 'Failed'
  if (normalized === 'refunded') return 'Refunded'
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatBdt(amount: number): string {
  return `৳${amount.toLocaleString('en-BD')}`
}

function resolveItemImageUrl(image: string, siteUrl: string): string {
  const trimmed = image?.trim() ?? ''
  if (!trimmed) return ''
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  const base = siteUrl.replace(/\/$/, '')
  if (trimmed.startsWith('/')) return `${base}${trimmed}`
  return `${base}/${trimmed}`
}

function formatProductVariant(item: StoredOrderItem): string {
  const parts = [item.size, item.color].filter(Boolean)
  return parts.join(' · ')
}

function renderProductThumb(item: StoredOrderItem, siteUrl: string): string {
  const imageUrl = resolveItemImageUrl(item.image, siteUrl)
  if (!imageUrl) {
    const initial = escapeInvoiceHtml(item.name.charAt(0).toUpperCase() || 'S')
    return `<div class="product-thumb product-thumb--empty" aria-hidden="true">${initial}</div>`
  }
  return `<div class="product-thumb"><img src="${escapeInvoiceHtml(imageUrl)}" alt="" /></div>`
}

export function renderInvoiceHtml(order: StoredOrder): string {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? SPLARO_INVOICE_BRAND.website
  const brandHeader = buildInvoiceBrandHeader(siteUrl)
  const paymentMethod = formatPaymentMethod(order.payment.method)
  const paymentStatus = formatPaymentStatus(order.payment.status)
  const issueDate = new Date(order.createdAt).toLocaleString('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const isCod = paymentMethod.toLowerCase().includes('cash')
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)

  const rows = order.items
    .map((item) => {
      const variant = formatProductVariant(item)
      return `
        <tr>
          <td class="cell-img">${renderProductThumb(item, siteUrl)}</td>
          <td class="cell-product">
            <div class="product-name">${escapeInvoiceHtml(item.name)}</div>
            ${variant ? `<div class="product-variant">${escapeInvoiceHtml(variant)}</div>` : ''}
          </td>
          <td class="num cell-qty"><span class="qty-pill">${item.quantity}</span></td>
          <td class="num">${formatBdt(item.price)}</td>
          <td class="num cell-amount"><strong>${formatBdt(item.price * item.quantity)}</strong></td>
        </tr>`
    })
    .join('')

  const discountRow =
    order.discount > 0
      ? `<div class="memo-line"><span>Discount</span><strong>- ${formatBdt(order.discount)}</strong></div>`
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cash Memo ${escapeInvoiceHtml(order.invoiceNumber)} — ${SPLARO_INVOICE_BRAND.name}</title>
  <style>
    :root {
      --ink: #111111;
      --soft: #3a3733;
      --muted: #7a756e;
      --accent: #9a8b6e;
      --rule: rgba(17,17,17,0.12);
      --rule-soft: rgba(17,17,17,0.06);
      --paper: #fffcf7;
      --wash: #f4f0e9;
      --wash-2: #f9f6f0;
      --ivory: #fffcf7;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      min-height: 100%;
      color: var(--ink);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 11px;
      line-height: 1.5;
      background:
        radial-gradient(ellipse 88% 55% at 50% -8%, #ebe6dc 0%, transparent 58%),
        linear-gradient(180deg, #ddd6ca 0%, #d2cbbd 100%);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    @page { size: A4 portrait; margin: 12mm; }

    .toolbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      justify-content: center;
      padding: 10px;
      background: rgba(255,252,247,0.94);
      border-bottom: 1px solid var(--rule-soft);
    }

    .toolbar button {
      border: 1px solid var(--ink);
      border-radius: 0;
      background: var(--ink);
      color: var(--ivory);
      cursor: pointer;
      font: 700 9px/1 system-ui, sans-serif;
      letter-spacing: 0.18em;
      padding: 10px 20px;
      text-transform: uppercase;
    }

    .memo-wrap {
      max-width: 580px;
      margin: 24px auto 36px;
      padding: 0 14px;
      position: relative;
    }

    .memo {
      position: relative;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.5) 0%, transparent 38%),
        var(--paper);
      border: 1px solid rgba(17,17,17,0.13);
      border-radius: 0;
      box-shadow: 0 1px 0 rgba(255,255,255,0.75) inset, 0 28px 64px rgba(28,22,14,0.11);
      overflow: hidden;
    }

    .memo::before {
      content: "";
      position: absolute;
      inset: 8px;
      border: 1px solid rgba(17,17,17,0.055);
      pointer-events: none;
    }

    .memo-inner {
      position: relative;
      padding: 28px 26px 24px;
    }

    .invoice-brand {
      text-align: center;
      margin-bottom: 16px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--rule);
    }

    .invoice-brand img {
      width: auto;
      max-width: 160px;
      max-height: 44px;
      object-fit: contain;
      display: block;
      margin: 0 auto 10px;
    }

    .invoice-brand__name {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 20px;
      font-weight: 400;
      letter-spacing: 0.28em;
      text-transform: uppercase;
    }

    .invoice-brand__tagline {
      margin-top: 4px;
      font-size: 8px;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 700;
    }

    .invoice-brand__office {
      margin-top: 6px;
      font-size: 9px;
      color: var(--soft);
    }

    .memo-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      margin: 4px 0 16px;
      padding: 12px 0;
      border-top: 1.5px solid var(--ink);
      border-bottom: 1px solid var(--ink);
    }

    .memo-title::before,
    .memo-title::after { display: none; }

    .memo-title span {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 18px;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      color: var(--ink);
      white-space: nowrap;
      font-weight: 500;
    }

    .memo-cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      margin-bottom: 18px;
      border: 1px solid var(--rule);
      background: linear-gradient(145deg, #fff 0%, var(--wash-2) 100%);
      overflow: hidden;
    }

    .memo-card {
      padding: 13px 15px;
      background: transparent;
      border: none;
      border-radius: 0;
      box-shadow: none;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }

    .memo-card--right {
      text-align: left;
      background: rgba(244,240,233,0.55);
      border-left: 1px solid var(--rule-soft);
    }

    .memo-card .label {
      font-size: 7px;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 5px;
    }

    .memo-card .value {
      font-size: 12px;
      font-weight: 600;
      line-height: 1.4;
    }

    .memo-card .value-muted {
      margin-top: 3px;
      font-size: 10px;
      font-weight: 500;
      color: var(--muted);
      line-height: 1.5;
    }

    .memo-no {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 18px;
      letter-spacing: 0.05em;
      font-weight: 600;
    }

    .memo-pay {
      margin-top: 6px;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
    }

    table.memo-items {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
    }

    table.memo-items thead th {
      padding: 9px 6px;
      border-top: none;
      border-bottom: 1.5px solid var(--ink);
      font-size: 7px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted);
      text-align: left;
      background: transparent;
    }

    table.memo-items tbody td {
      padding: 10px 6px;
      border-bottom: 1px solid var(--rule-soft);
      vertical-align: middle;
    }

    table.memo-items tbody tr:last-child td {
      border-bottom: 1.5px solid var(--ink);
    }

    .cell-img { width: 56px; }
    .cell-product { min-width: 0; }
    .cell-qty { width: 44px; }
    .cell-amount { width: 80px; }
    .num { text-align: right; white-space: nowrap; }

    .product-thumb {
      width: 50px;
      height: 62px;
      border: 1px solid var(--rule);
      border-radius: 0;
      overflow: hidden;
      background: var(--wash);
      box-shadow: none;
    }

    .product-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
      display: block;
    }

    .product-thumb--empty {
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Georgia, serif;
      font-size: 16px;
      color: var(--muted);
    }

    .product-name {
      font-size: 11.5px;
      font-weight: 600;
      line-height: 1.4;
    }

    .product-variant {
      margin-top: 3px;
      font-size: 9px;
      font-weight: 500;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .qty-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: auto;
      padding: 0;
      border: none;
      border-radius: 0;
      font-size: 11px;
      font-weight: 700;
      background: transparent;
      box-shadow: none;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }

    .memo-bottom {
      display: grid;
      grid-template-columns: 1fr 220px;
      gap: 18px;
      align-items: start;
    }

    .memo-notes {
      padding-top: 4px;
      font-size: 9.5px;
      color: var(--muted);
      line-height: 1.6;
    }

    .memo-notes strong {
      display: block;
      margin-bottom: 5px;
      font-size: 7px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .memo-totals {
      padding: 0;
      background: transparent;
      border: none;
      border-radius: 0;
      box-shadow: none;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }

    .memo-line {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 4px 0;
      font-size: 10.5px;
      color: var(--muted);
    }

    .memo-line strong {
      color: var(--ink);
      font-weight: 600;
    }

    .memo-grand {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-top: 10px;
      padding: 12px 14px;
      margin-left: 0;
      margin-right: 0;
      margin-bottom: 0;
      border-top: none;
      background: #111111;
      border-radius: 0;
      color: var(--ivory);
      box-shadow: inset 3px 0 0 0 var(--accent);
    }

    .memo-grand span:first-child {
      font-size: 7px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(255,252,247,0.48);
    }

    .memo-grand strong {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 20px;
      font-weight: 500;
      color: var(--ivory);
    }

    .memo-footer {
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid var(--rule);
      text-align: center;
      font-size: 9.5px;
      color: var(--muted);
      line-height: 1.65;
    }

    .memo-footer .thanks {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 11px;
      color: var(--ink);
      margin-bottom: 5px;
      line-height: 1.5;
    }

    @media print {
      .toolbar { display: none !important; }
      html, body { background: #fff !important; background-image: none !important; }
      .memo-wrap { margin: 0; padding: 0; max-width: none; }
      .memo,
      .memo-card,
      .memo-totals,
      .qty-pill {
        background: #fff !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        box-shadow: none !important;
      }
      .memo::before { display: none; }
      .memo { box-shadow: none; border-radius: 0; border: 1px solid #ddd; }
      .memo-grand {
        background: #111 !important;
        box-shadow: inset 3px 0 0 0 #9a8b6e !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .memo-card--right {
        background: #f9f6f0 !important;
      }
      tr { break-inside: avoid; page-break-inside: avoid; }
    }

    @media (max-width: 640px) {
      .memo-inner { padding: 20px 16px; }
      .memo-cards { grid-template-columns: 1fr; }
      .memo-card--right { text-align: left; }
      .memo-bottom { grid-template-columns: 1fr; }
      table.memo-items thead .hide-sm { display: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button type="button" onclick="window.print()">Print / Save PDF</button>
  </div>

  <div class="memo-wrap">
    <article class="memo">
      <div class="memo-inner">
        ${brandHeader}

        <div class="memo-title">
          <span>Cash Memo</span>
          <div class="memo-title__meta">
            <div class="label" style="margin:0 0 3px;text-align:right;">Invoice</div>
            <div class="value memo-no" style="text-align:right;">${escapeInvoiceHtml(order.invoiceNumber)}</div>
          </div>
        </div>

        <div class="memo-cards">
          <div class="memo-card">
            <div class="label">Customer</div>
            <div class="value">${escapeInvoiceHtml(order.customer.name)}</div>
            <div class="value-muted">
              ${escapeInvoiceHtml(order.customer.phone)}<br />
              ${escapeInvoiceHtml(order.customer.address)}, ${escapeInvoiceHtml(order.customer.city)}
            </div>
          </div>
          <div class="memo-card memo-card--right">
            <div class="label">Memo No.</div>
            <div class="value memo-no">${escapeInvoiceHtml(order.invoiceNumber)}</div>
            <div class="value-muted">${escapeInvoiceHtml(issueDate)}</div>
            <div class="memo-pay">${escapeInvoiceHtml(paymentMethod)} · ${escapeInvoiceHtml(paymentStatus)} · ${itemCount} pc</div>
          </div>
        </div>

        <table class="memo-items">
          <thead>
            <tr>
              <th colspan="2">Product</th>
              <th class="num">Qty</th>
              <th class="num hide-sm">Rate</th>
              <th class="num">Amount</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="memo-bottom">
          <div class="memo-notes">
            <strong>Note</strong>
            ${isCod ? escapeInvoiceHtml(SPLARO_INVOICE_BRAND.codPaymentTerms) + '. ' : ''}
            For support, quote memo <strong>${escapeInvoiceHtml(order.invoiceNumber)}</strong>.
          </div>
          <div class="memo-totals">
            <div class="memo-line"><span>Subtotal</span><strong>${formatBdt(order.subtotal)}</strong></div>
            <div class="memo-line"><span>Delivery</span><strong>${order.delivery === 0 ? 'Free' : formatBdt(order.delivery)}</strong></div>
            ${discountRow}
            <div class="memo-grand">
              <span>Net payable</span>
              <strong>${formatBdt(order.total)}</strong>
            </div>
          </div>
        </div>

        <footer class="memo-footer">
          <div class="thanks">${escapeInvoiceHtml(SPLARO_INVOICE_BRAND.thankYouNote)}</div>
          ${escapeInvoiceHtml(SPLARO_INVOICE_BRAND.websiteDisplay)} · ${escapeInvoiceHtml(SPLARO_INVOICE_BRAND.phone)} · ${escapeInvoiceHtml(SPLARO_INVOICE_BRAND.email)}
        </footer>
      </div>
    </article>
  </div>
</body>
</html>`
}
