import type { InvoiceInput } from './types.js'

export const SPLARO_INVOICE_BRAND = {
  name: 'SPLARO',
  tagline: 'Modesty. Refined.',
  phone: '01905010205',
  email: 'support@splaro.co',
  website: 'https://www.splaro.co',
  websiteDisplay: 'www.splaro.co',
  office: 'Uttara Sector 13, Dhaka — 1230',
  arabicLogoPath: '/images/logo/splaro-logo-white-premium.png',
  thankYouNote:
    'Thank you for choosing SPLARO. Your order has been carefully prepared with premium quality, modest elegance, and care.',
} as const

export function resolveInvoiceLogoUrl(siteUrl: string, storeLogo?: string | null): string {
  const base = siteUrl.replace(/\/$/, '')
  const trimmed = storeLogo?.trim()
  if (trimmed) {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
    if (trimmed.startsWith('/')) return `${base}${trimmed}`
    return `${base}/${trimmed}`
  }
  return `${base}${SPLARO_INVOICE_BRAND.arabicLogoPath}`
}

export function escapeHtml(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatBdt(amount: number): string {
  return `৳${amount.toLocaleString('en-BD', { maximumFractionDigits: 2 })}`
}

export function resolveBrandContext(input: InvoiceInput) {
  const siteUrl = input.siteUrl ?? SPLARO_INVOICE_BRAND.website
  return {
    brand: SPLARO_INVOICE_BRAND,
    logoUrl: resolveInvoiceLogoUrl(siteUrl, input.storeLogo),
    siteUrl,
  }
}

export function itemRowsHtml(items: InvoiceInput['items']): string {
  return items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.productName)}</td>
        <td>${escapeHtml(item.sku)}</td>
        <td>${escapeHtml(item.size)}</td>
        <td>${escapeHtml(item.color)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${formatBdt(item.unitPrice)}</td>
        <td class="num">${formatBdt(item.lineTotal)}</td>
      </tr>`,
    )
    .join('')
}

export function receiptLinesHtml(items: InvoiceInput['items']): string {
  return items
    .map(
      (item) => `
      <div class="line">
        <span class="name">${escapeHtml(item.productName)}</span>
        <span class="qty">${item.quantity} × ${formatBdt(item.unitPrice)}</span>
      </div>
      ${item.size !== '—' ? `<div class="meta">${escapeHtml(item.size)}${item.color !== '—' ? ` · ${escapeHtml(item.color)}` : ''}</div>` : ''}`,
    )
    .join('')
}
