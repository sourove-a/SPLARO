import { SPLARO_INVOICE_BRAND, resolveEmailLogoUrl } from './splaro-invoice-brand'

const DEFAULT_SITE_URL = SPLARO_INVOICE_BRAND.website

/** Light-surface shared header (web memo / print wrappers) — black wordmark PNG. */
export function buildInvoiceBrandHeader(siteUrl: string = DEFAULT_SITE_URL): string {
  const logoUrl = resolveEmailLogoUrl(siteUrl)

  return `
  <div class="invoice-brand">
    <img src="${logoUrl}" alt="${SPLARO_INVOICE_BRAND.name}" width="140" height="74" style="height:auto;max-height:56px;width:140px;object-fit:contain;display:block;margin:0 auto 12px;" />
    <div class="invoice-brand__name">${SPLARO_INVOICE_BRAND.name}</div>
    <p class="invoice-brand__tagline">${SPLARO_INVOICE_BRAND.tagline}</p>
    <p class="invoice-brand__office">${SPLARO_INVOICE_BRAND.office} · ${SPLARO_INVOICE_BRAND.phone}</p>
  </div>
`
}

export const invoiceBrandHeader = buildInvoiceBrandHeader()
export const emailBrandHeader = invoiceBrandHeader
