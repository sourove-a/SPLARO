import type { Metadata, Viewport } from 'next'
import { cormorant, inter } from '@/fonts/storefront-fonts'
import './globals.css'
import '@/styles/typography.css'
import '@/styles/motion-language.css'
import '@/styles/premium-icons.css'
import '@/styles/button-system.css'
import '@/styles/nav-language.css'
import '@/styles/scroll-story.css'
import '@/styles/scroll-idle.css'
import { Providers } from '@/components/layout/Providers'
import { StorefrontChrome } from '@/components/layout/StorefrontChrome'
import { Toaster } from '@/components/ui/Toast/Toaster'
import { GlobalPressFeedback } from '@/components/ui/GlobalPressFeedback'
import { StorefrontSettingsProvider } from '@/components/providers/StorefrontSettingsProvider'
import { AnalyticsScripts } from '@/components/analytics/AnalyticsScripts'
import { GoogleAnalyticsHead, GA_ENV_ID } from '@/components/analytics/GoogleAnalyticsHead'
import { AttributionCapture } from '@/components/analytics/AttributionCapture'
import { RouteAnalyticsTracker } from '@/components/analytics/RouteAnalyticsTracker'
import { STRIP_EXTENSION_ATTRS_SCRIPT } from '@/lib/hydration/strip-extension-attrs'
import { WINDOWS_NATIVE_SCROLL_SCRIPT } from '@/lib/hydration/windows-native-scroll-script'
import { CHUNK_RECOVERY_SCRIPT } from '@/lib/hydration/chunk-recovery-script'
import { CRITICAL_HOME_CSS } from '@/lib/hydration/critical-home-css'
import { getBuildId } from '@/lib/build-id'
import { SPLARO_TAB_ICONS, splaroMetadataIcons } from '@splaro/config'
import { getStorefrontSettings } from '@/lib/storefront/settings'
import {
  SPLARO_HOME_DESCRIPTION,
  SPLARO_ORG_DESCRIPTION,
} from '@/lib/seo/brand-positioning'
import { resolveDefaultStorefrontMeta } from '@/lib/seo/default-meta'
import { serializeJsonLd } from '@/lib/seo/json-ld'
import { DEFAULT_SUPPORT_EMAIL, DEFAULT_SUPPORT_PHONE_E164 } from '@/lib/storefront/defaults'

function resolvePublicCarePhone(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SUPPORT_PHONE,
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
    DEFAULT_SUPPORT_PHONE_E164,
  ]
  for (const raw of candidates) {
    const value = raw?.trim()
    if (!value) continue
    const digits = value.replace(/\D/g, '')
    // Reject empty / obvious placeholders (01700000000 family).
    if (digits.length < 10) continue
    if (/^880?170{5,}/.test(digits) || /^0170{5,}/.test(digits)) continue
    if (value.includes('X')) continue
    return value.startsWith('+') ? value : digits.startsWith('880') ? `+${digits}` : value
  }
  return DEFAULT_SUPPORT_PHONE_E164
}

export const revalidate = 60

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splaro.co'
const cdnOrigin = (() => {
  const candidates = [
    process.env.NEXT_PUBLIC_CDN_URL?.trim(),
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim(),
    siteUrl,
  ]
  const broken = new Set(['cdn.splaro.co', 'cdn.splaro.com.bd'])
  for (const raw of candidates) {
    if (!raw) continue
    try {
      const origin = new URL(raw).origin
      if (broken.has(new URL(origin).hostname.toLowerCase())) continue
      return origin
    } catch {
      /* try next */
    }
  }
  return 'https://splaro.co'
})()

export async function generateMetadata(): Promise<Metadata> {
  const { title, description, googleSiteVerification } = await resolveDefaultStorefrontMeta()
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: '%s | SPLARO',
    },
    description,
    keywords: [
      'SPLARO',
      'SPLARO Bangladesh',
      'premium fashion Bangladesh',
      'fashion Dhaka',
      'buy clothes online Bangladesh',
      'COD fashion Bangladesh',
      'men fashion Bangladesh',
      'women fashion Bangladesh',
      'kids fashion Bangladesh',
      'apparel Bangladesh',
      'ethnic wear Bangladesh',
      'panjabi online',
      'handbags Bangladesh',
      'footwear Bangladesh',
      'accessories Bangladesh',
      'Uttara fashion store',
    ],
    authors: [{ name: 'SPLARO', url: siteUrl }],
    creator: 'SPLARO',
    publisher: 'SPLARO',
    category: 'shopping',
    applicationName: 'SPLARO',
    alternates: {
      canonical: siteUrl,
      languages: { 'en-BD': siteUrl, en: siteUrl },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      type: 'website',
      locale: 'en_BD',
      alternateLocale: ['en_US'],
      siteName: 'SPLARO',
      title,
      description,
      url: siteUrl,
      images: [
        {
          url: `${siteUrl}/og-cover.jpg`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${siteUrl}/og-cover.jpg`],
      creator: '@splaro_official',
    },
    icons: splaroMetadataIcons,
    ...(googleSiteVerification
      ? {
          verification: {
            google: googleSiteVerification,
          },
        }
      : {}),
    ...(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim() ||
    process.env.NEXT_PUBLIC_FACEBOOK_DOMAIN_VERIFICATION?.trim()
      ? {
          other: {
            ...(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim()
              ? { 'msvalidate.01': process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION.trim() }
              : {}),
            ...(process.env.NEXT_PUBLIC_FACEBOOK_DOMAIN_VERIFICATION?.trim()
              ? {
                  'facebook-domain-verification':
                    process.env.NEXT_PUBLIC_FACEBOOK_DOMAIN_VERIFICATION.trim(),
                }
              : {}),
          },
        }
      : {}),
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  /** Lock storefront to light — phone OS dark mode must not autodarken UI. */
  colorScheme: 'only light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#ffffff' },
  ],
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getStorefrontSettings()
  const buildId = getBuildId()
  const rawFavicon = settings.store.favicon?.trim() || ''
  const faviconUrl =
    !rawFavicon ||
    rawFavicon.includes('brand-mark-transparent') ||
    rawFavicon.includes('splaro-brand-mark-tab') ||
    rawFavicon.includes('favicon.svg')
      ? SPLARO_TAB_ICONS.faviconIco
      : rawFavicon
  const appleIconUrl =
    !rawFavicon ||
    rawFavicon.includes('brand-mark-transparent') ||
    rawFavicon.includes('splaro-brand-mark-tab') ||
    rawFavicon.includes('favicon.svg')
      ? SPLARO_TAB_ICONS.apple180
      : rawFavicon

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${cormorant.variable}`}
      data-color-scheme="light"
      style={{ colorScheme: 'light only', backgroundColor: '#ffffff' }}
    >
      <head>
        {/* Phone OS dark mode — keep SPLARO white/light on every device */}
        <meta name="color-scheme" content="only light" />
        <meta name="supported-color-schemes" content="light" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="splaro-build" content={buildId} />
        <GoogleAnalyticsHead />
        <link rel="preconnect" href={cdnOrigin} />
        <link rel="dns-prefetch" href={cdnOrigin} />
        <link rel="icon" href={SPLARO_TAB_ICONS.faviconIco} sizes="any" />
        <link rel="icon" href={SPLARO_TAB_ICONS.icon16} sizes="16x16" type="image/png" />
        <link rel="icon" href={SPLARO_TAB_ICONS.icon32} sizes="32x32" type="image/png" />
        <link rel="icon" href={SPLARO_TAB_ICONS.icon48} sizes="48x48" type="image/png" />
        <link rel="shortcut icon" href={faviconUrl || SPLARO_TAB_ICONS.faviconIco} />
        <link rel="apple-touch-icon" href={appleIconUrl} sizes="180x180" />
        <link rel="manifest" href="/icons/site.webmanifest" />
        {/* GEO/AEO — machine-readable brand brief for ChatGPT / Claude / Perplexity / Gemini */}
        <link rel="describedby" href="/llms.txt" type="text/plain" title="llms.txt" />
        <link rel="alternate" href="/llms.txt" type="text/plain" title="LLM Brand Brief" />
        <link rel="alternate" href="/ai.txt" type="text/plain" title="AI Crawler Policy" />
        <link rel="alternate" type="application/rss+xml" title="SPLARO RSS" href="/feed.xml" />
        <link
          rel="alternate"
          type="application/xml"
          title="Google Merchant Feed"
          href="/feeds/google-merchant.xml"
        />
        {/* Structured Data — Organization
            Safe: content is fully static, no user-controlled input ever reaches here */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              '@id': `${siteUrl}/#organization`,
              name: 'SPLARO',
              legalName: 'SPLARO',
              alternateName: ['SPLARO Bangladesh', 'SPLARO Fashion'],
              url: siteUrl,
              logo: `${siteUrl}/images/logo/splaro-logo-black-premium.png`,
              image: `${siteUrl}/og-cover.jpg`,
              slogan: 'Modesty. Refined.',
              description: SPLARO_ORG_DESCRIPTION,
              foundingLocation: {
                '@type': 'Place',
                name: 'Dhaka, Bangladesh',
              },
              areaServed: { '@type': 'Country', name: 'Bangladesh' },
              knowsAbout: [
                'premium fashion Bangladesh',
                'apparel Bangladesh',
                'men fashion',
                'women fashion',
                'kids fashion',
                'footwear',
                'accessories',
                'handbags',
                'ethnic wear',
                'cash on delivery Bangladesh',
              ],
              contactPoint: {
                '@type': 'ContactPoint',
                telephone: resolvePublicCarePhone(),
                email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL,
                contactType: 'customer service',
                areaServed: 'BD',
                availableLanguage: ['English', 'Bengali'],
              },
              sameAs: [
                'https://www.instagram.com/splaro.bd',
                'https://www.facebook.com/SPLARO/',
                'https://www.youtube.com/@SPLARO',
              ],
            }),
          }}
        />
        {/* Structured Data — WebSite + OnlineStore (sitelinks search box + GEO/AEO signals).
            Helps AI answer-engines understand SPLARO as a Bangladesh fashion store. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'WebSite',
                  '@id': `${siteUrl}/#website`,
                  url: siteUrl,
                  name: 'SPLARO',
                  alternateName: 'SPLARO Bangladesh',
                  description: SPLARO_HOME_DESCRIPTION,
                  inLanguage: ['en', 'en-BD'],
                  publisher: { '@id': `${siteUrl}/#organization` },
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: {
                      '@type': 'EntryPoint',
                      urlTemplate: `${siteUrl}/search?q={search_term_string}`,
                    },
                    'query-input': 'required name=search_term_string',
                  },
                },
                {
                  '@type': 'OnlineStore',
                  '@id': `${siteUrl}/#store`,
                  name: 'SPLARO',
                  url: siteUrl,
                  image: `${siteUrl}/images/logo/splaro-logo-black-premium.png`,
                  description: SPLARO_ORG_DESCRIPTION,
                  priceRange: '৳৳',
                  currenciesAccepted: 'BDT',
                  paymentAccepted: 'Cash on Delivery, bKash, Nagad, Card',
                  areaServed: { '@type': 'Country', name: 'Bangladesh' },
                  availableLanguage: ['English', 'Bengali'],
                  parentOrganization: { '@id': `${siteUrl}/#organization` },
                },
              ],
            }),
          }}
        />
        <style id="splaro-critical-home" dangerouslySetInnerHTML={{ __html: CRITICAL_HOME_CSS }} />
      </head>
      <body
        className={`${inter.className} antialiased`}
        suppressHydrationWarning
        style={{ backgroundColor: '#ffffff' }}
      >
        <a className="storefront-skip-link" href="#main-content">
          Skip to main content
        </a>
        <script dangerouslySetInnerHTML={{ __html: STRIP_EXTENSION_ATTRS_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: WINDOWS_NATIVE_SCROLL_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: CHUNK_RECOVERY_SCRIPT }} />
        <Providers>
          <StorefrontSettingsProvider settings={settings}>
            <AnalyticsScripts envGaId={GA_ENV_ID} />
            <AttributionCapture />
            <RouteAnalyticsTracker />
            <StorefrontChrome>{children}</StorefrontChrome>
            <Toaster />
            <GlobalPressFeedback />
          </StorefrontSettingsProvider>
        </Providers>
      </body>
    </html>
  )
}
