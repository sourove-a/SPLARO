import { SPLARO_INVOICE_BRAND, resolveInvoiceLogoUrl } from './splaro-invoice-brand'

const DEFAULT_SITE_URL = SPLARO_INVOICE_BRAND.website

/** Shared SPLARO invoice / PDF / email brand header markup (absolute logo URL for API/PDF) */
export function buildInvoiceBrandHeader(siteUrl: string = DEFAULT_SITE_URL): string {
  const logoUrl = resolveInvoiceLogoUrl(siteUrl)

  return `
  <div class="invoice-brand">
    <img src="${logoUrl}" alt="${SPLARO_INVOICE_BRAND.name}" width="180" style="height:auto;max-height:72px;object-fit:contain;display:block;margin:0 auto 12px;" />
    <div class="invoice-brand__name">${SPLARO_INVOICE_BRAND.name}</div>
    <p class="invoice-brand__tagline">${SPLARO_INVOICE_BRAND.tagline}</p>
    <p class="invoice-brand__office">${SPLARO_INVOICE_BRAND.office} · ${SPLARO_INVOICE_BRAND.phone}</p>
  </div>
`
}

export const invoiceBrandHeader = buildInvoiceBrandHeader()
export const emailBrandHeader = invoiceBrandHeader
