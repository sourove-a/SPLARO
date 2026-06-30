/** Official SPLARO invoice / print / email brand constants */
export const SPLARO_INVOICE_BRAND = {
  name: 'SPLARO',
  tagline: 'Modesty. Refined.',
  phone: '01905010205',
  phoneE164: '8801905010205',
  email: 'support@splaro.com.bd',
  website: 'https://www.splaro.com.bd',
  websiteDisplay: 'www.splaro.com.bd',
  office: 'Uttara Sector 13, Dhaka - 1230',
  supportLine: 'Online Order & Client Support',
  arabicLogoPath: '/images/logo/splaro-brand-mark-transparent.png',
  thankYouNote:
    'Thank you for choosing SPLARO. Your order has been carefully prepared with premium quality, modest elegance, and care.',
  codPaymentTerms: 'Pay after receiving product',
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
