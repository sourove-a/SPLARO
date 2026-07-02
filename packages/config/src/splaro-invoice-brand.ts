function siteHostname(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.WEB_URL ?? 'https://splaro.co'
  try {
    return new URL(raw).hostname.replace(/^www\./, '')
  } catch {
    return 'splaro.co'
  }
}

const host = siteHostname()

/** Official SPLARO invoice / print / email brand constants */
export const SPLARO_INVOICE_BRAND = {
  name: 'SPLARO',
  tagline: 'Modesty. Refined.',
  phone: process.env.COMPANY_PHONE ?? '01905010205',
  phoneE164: process.env.COMPANY_PHONE_E164 ?? '8801905010205',
  email: process.env.COMPANY_EMAIL ?? process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? `support@${host}`,
  website: process.env.COMPANY_WEBSITE ?? `https://www.${host}`,
  websiteDisplay: process.env.COMPANY_WEBSITE_DISPLAY ?? `www.${host}`,
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
