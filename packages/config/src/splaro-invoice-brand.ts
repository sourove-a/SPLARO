/**
 * Public brand host for invoices / print / email footers.
 * Never use localhost / 127.0.0.1 — local NEXT_PUBLIC_SITE_URL is for apps only.
 */

/** Exported for unit tests — strip www + reject loopback / .local hosts. */
export function sanitizePublicHostname(raw: string): string | null {
  const input = raw.trim()
  if (!input) return null
  try {
    const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`
    const hostname = new URL(withProto).hostname.replace(/^www\./, '').toLowerCase()
    if (
      !hostname ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.localhost')
    ) {
      return null
    }
    return hostname
  } catch {
    return null
  }
}

function siteHostname(): string {
  const raw =
    process.env.COMPANY_WEBSITE ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.WEB_URL ??
    'https://splaro.co'
  return sanitizePublicHostname(raw) ?? 'splaro.co'
}

function isUnsafeSupportEmail(email: string): boolean {
  return (
    /@localhost\b/i.test(email) ||
    /@127\.0\.0\.1\b/i.test(email) ||
    /@0\.0\.0\.0\b/i.test(email) ||
    /@[^@]+\.local\b/i.test(email) ||
    /@[^@]+\.localhost\b/i.test(email)
  )
}

function publicSupportEmail(host: string): string {
  // Invoice contact is brand COMPANY_EMAIL only — do not inherit storefront NEXT_PUBLIC_SUPPORT_EMAIL
  // (web/.env.local may use support@ while invoices must show info@splaro.co).
  const fromEnv = (process.env.COMPANY_EMAIL ?? '').trim()
  if (fromEnv && !isUnsafeSupportEmail(fromEnv)) {
    return fromEnv
  }
  return host === 'splaro.co' ? 'info@splaro.co' : `info@${host}`
}

/** Sanitize COMPANY_WEBSITE_DISPLAY so www.localhost never ships on invoices. */
export function sanitizeWebsiteDisplay(raw: string | undefined, fallbackHost: string): string {
  const candidate = (raw ?? '').trim()
  if (!candidate) return `www.${fallbackHost}`
  const host = sanitizePublicHostname(candidate)
  if (!host) return `www.${fallbackHost}`
  return candidate.toLowerCase().startsWith('www.') ? `www.${host}` : host
}

/**
 * `wa.me` and the invoice footer both want bare digits. `COMPANY_PHONE_E164` is
 * routinely written as `+8801905010205`, and a `+` in a wa.me path produces a
 * link WhatsApp cannot open — so the country-code form is normalised once here
 * instead of at each call site.
 */
function normalizeE164Digits(raw: string | undefined, fallback: string): string {
  const digits = (raw ?? '').replace(/\D/g, '')
  return digits || fallback
}

const host = siteHostname()

/** Official SPLARO invoice / print / email brand constants */
export const SPLARO_INVOICE_BRAND = {
  name: 'SPLARO',
  tagline: 'Modesty. Refined.',
  phone: process.env.COMPANY_PHONE ?? process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? '01905010205',
  phoneE164: normalizeE164Digits(process.env.COMPANY_PHONE_E164, '8801905010205'),
  email: publicSupportEmail(host),
  website: process.env.COMPANY_WEBSITE?.startsWith('http')
    ? sanitizePublicHostname(process.env.COMPANY_WEBSITE)
      ? process.env.COMPANY_WEBSITE
      : `https://www.${host}`
    : `https://www.${host}`,
  websiteDisplay: sanitizeWebsiteDisplay(process.env.COMPANY_WEBSITE_DISPLAY, host),
  office: 'House 84, Road 12, Sector 13, Uttara, Dhaka 1230',
  supportLine: 'Online Order & Client Support',
  /** Light-surface print / web memo — black premium wordmark. */
  printLogoPath: '/images/logo/splaro-logo-black-premium.png',
  /** Ivory invoice — official gold wordmark (transparent PNG from brand gold mark). */
  invoiceGoldLogoPath: '/images/logo/splaro-logo-gold-invoice.png',
  /** Seamless ivory leather grain for invoice material layer. */
  invoiceLeatherGrainPath: '/images/logo/invoice-leather-grain.png',
  /** Dark-hero PDF/print — compact white PNG (email clients + Puppeteer both render PNG). */
  arabicLogoPath: '/images/logo/splaro-logo-invoice-white.png',
  /** Light-surface email header — compact black PNG (WebP breaks in Gmail/Outlook). */
  emailLogoPath: '/images/logo/splaro-logo-email.png',
  thankYouNote: 'Thank you for choosing SPLARO. Crafted with care — quiet luxury, delivered.',
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
  return `${base}${SPLARO_INVOICE_BRAND.printLogoPath}`
}

/** Absolute black wordmark for order confirmation emails (PNG only). */
export function resolveEmailLogoUrl(siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, '')
  return `${base}${SPLARO_INVOICE_BRAND.emailLogoPath}`
}
