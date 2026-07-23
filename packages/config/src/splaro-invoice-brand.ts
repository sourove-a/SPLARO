/**
 * Public brand host for invoices / print / email footers.
 * Never use localhost / 127.0.0.1 — local NEXT_PUBLIC_SITE_URL is for apps only.
 */
function siteHostname(): string {
  const raw =
    process.env.COMPANY_WEBSITE ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.WEB_URL ??
    'https://splaro.co'
  try {
    const hostname = new URL(raw).hostname.replace(/^www\./, '').toLowerCase()
    if (
      !hostname ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.localhost')
    ) {
      return 'splaro.co'
    }
    return hostname
  } catch {
    return 'splaro.co'
  }
}

function publicSupportEmail(host: string): string {
  const fromEnv = (process.env.COMPANY_EMAIL ?? process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? '').trim()
  if (fromEnv && !/@localhost\b/i.test(fromEnv) && !/@127\.0\.0\.1\b/i.test(fromEnv)) {
    return fromEnv
  }
  return `support@${host}`
}

const host = siteHostname()

/** Official SPLARO invoice / print / email brand constants */
export const SPLARO_INVOICE_BRAND = {
  name: 'SPLARO',
  tagline: 'Modesty. Refined.',
  phone: process.env.COMPANY_PHONE ?? process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? '01905010205',
  phoneE164: process.env.COMPANY_PHONE_E164 ?? '8801905010205',
  email: publicSupportEmail(host),
  website: process.env.COMPANY_WEBSITE?.startsWith('http')
    ? process.env.COMPANY_WEBSITE
    : `https://www.${host}`,
  websiteDisplay: process.env.COMPANY_WEBSITE_DISPLAY ?? `www.${host}`,
  office: 'Uttara Sector 13, Dhaka - 1230',
  supportLine: 'Online Order & Client Support',
  /** Dark-hero PDF/print — compact white PNG (email clients + Puppeteer both render PNG). */
  arabicLogoPath: '/images/logo/splaro-logo-invoice-white.png',
  /** Light-surface email header — compact black PNG (WebP breaks in Gmail/Outlook). */
  emailLogoPath: '/images/logo/splaro-logo-email.png',
  thankYouNote:
    'Thank you for choosing SPLARO. Crafted with care — quiet luxury, delivered.',
  codPaymentTerms: 'Pay after receiving product',
} as const

function isUsableRemoteLogo(url: string): boolean {
  const lower = url.toLowerCase()
  // Prefer official assets — store uploads are often relative/webp/broken in mail + PDF.
  if (lower.includes('localhost') || lower.includes('127.0.0.1')) return false
  if (lower.endsWith('.webp')) return false
  return true
}

export function resolveInvoiceLogoUrl(siteUrl: string, storeLogo?: string | null): string {
  const base = siteUrl.replace(/\/$/, '')
  const trimmed = storeLogo?.trim()
  if (trimmed) {
    const resolved =
      trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : trimmed.startsWith('/')
          ? `${base}${trimmed}`
          : `${base}/${trimmed}`
    if (isUsableRemoteLogo(resolved)) return resolved
  }
  return `${base}${SPLARO_INVOICE_BRAND.arabicLogoPath}`
}

/** Absolute black wordmark for order confirmation emails (PNG only). */
export function resolveEmailLogoUrl(siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, '')
  return `${base}${SPLARO_INVOICE_BRAND.emailLogoPath}`
}
