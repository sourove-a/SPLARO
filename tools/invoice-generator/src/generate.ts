import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  escapeHtml,
  formatBdt,
  itemRowsHtml,
  receiptLinesHtml,
  resolveBrandContext,
} from './helpers.js'
import type { GenerateOptions, InvoiceInput, InvoiceTemplateKind } from './types.js'

const distRoot = join(dirname(fileURLToPath(import.meta.url)))

function loadTemplate(kind: InvoiceTemplateKind): string {
  const file =
    kind === 'a4'
      ? 'invoice-a4.html'
      : kind === 'receipt'
        ? 'receipt-80mm.html'
        : 'shipping-label.html'
  const path = join(distRoot, 'templates', file)
  return readFileSync(path, 'utf8')
}

function loadCss(): string {
  return readFileSync(join(distRoot, 'assets', 'invoice.css'), 'utf8')
}

function replaceAll(template: string, map: Record<string, string>): string {
  let out = template
  for (const [key, value] of Object.entries(map)) {
    out = out.replaceAll(`{{${key}}}`, value)
  }
  return out
}

export function generateInvoiceHtml(
  input: InvoiceInput,
  options: GenerateOptions = {},
): string {
  const kind = options.template ?? 'a4'
  const { brand, logoUrl, siteUrl } = resolveBrandContext(input)
  const css = loadCss()
  const template = loadTemplate(kind)

  const common = {
    CSS: css,
    BRAND_NAME: escapeHtml(brand.name),
    BRAND_TAGLINE: escapeHtml(brand.tagline),
    BRAND_PHONE: escapeHtml(brand.phone),
    BRAND_EMAIL: escapeHtml(brand.email),
    BRAND_OFFICE: escapeHtml(brand.office),
    BRAND_WEBSITE: escapeHtml(brand.websiteDisplay),
    LOGO_URL: escapeHtml(logoUrl),
    SITE_URL: escapeHtml(siteUrl),
    INVOICE_NUMBER: escapeHtml(input.invoiceNumber),
    ORDER_ID: escapeHtml(input.orderId),
    ISSUE_DATE: escapeHtml(input.issueDate),
    CUSTOMER_NAME: escapeHtml(input.customerName),
    CUSTOMER_PHONE: escapeHtml(input.customerPhone),
    CUSTOMER_EMAIL: escapeHtml(input.customerEmail ?? '—'),
    SHIPPING_ADDRESS: escapeHtml(input.shippingAddress),
    SHIPPING_CITY: escapeHtml(input.shippingCity),
    SHIPPING_DISTRICT: escapeHtml(input.shippingDistrict),
    PAYMENT_METHOD: escapeHtml(input.paymentMethod),
    PAYMENT_STATUS: escapeHtml(input.paymentStatus),
    ORDER_STATUS: escapeHtml(input.orderStatus),
    SUBTOTAL: formatBdt(input.subtotal),
    DELIVERY: formatBdt(input.deliveryCharge),
    DISCOUNT: input.discount > 0 ? `-${formatBdt(input.discount)}` : '—',
    TOTAL: formatBdt(input.total),
    COUPON: escapeHtml(input.couponCode ?? ''),
    COUPON_ROW: input.couponCode
      ? `<div class="summary-row summary-row--accent"><span>Coupon (${escapeHtml(input.couponCode)})</span><strong>-${formatBdt(input.discount)}</strong></div>`
      : '',
    COURIER: escapeHtml(input.courierName ?? '—'),
    TRACKING: escapeHtml(input.trackingCode ?? '—'),
    THANK_YOU: escapeHtml(brand.thankYouNote),
    TOOLBAR: options.showToolbar
      ? `<div class="toolbar no-print"><button onclick="window.print()">Print</button></div>`
      : '',
    AUTO_PRINT: options.autoPrint ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),300))</script>' : '',
    ITEM_ROWS: itemRowsHtml(input.items),
    RECEIPT_LINES: receiptLinesHtml(input.items),
  }

  return replaceAll(template, common)
}

export { sampleInvoice } from './sample-order.js'
export type { InvoiceInput, GenerateOptions, InvoiceTemplateKind } from './types.js'
