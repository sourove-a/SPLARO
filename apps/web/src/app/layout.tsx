import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/layout/Providers'
import { StorefrontChrome } from '@/components/layout/StorefrontChrome'
import { Toaster } from '@/components/ui/Toast/Toaster'
import { GlobalPressFeedback } from '@/components/ui/GlobalPressFeedback'
import { StorefrontSettingsProvider } from '@/components/providers/StorefrontSettingsProvider'
import { AnalyticsScripts } from '@/components/analytics/AnalyticsScripts'
import { GoogleAnalyticsHead, GA_ENV_ID } from '@/components/analytics/GoogleAnalyticsHead'
import { AttributionCapture } from '@/components/analytics/AttributionCapture'
import { STRIP_EXTENSION_ATTRS_SCRIPT } from '@/lib/hydration/strip-extension-attrs'
import { WINDOWS_NATIVE_SCROLL_SCRIPT } from '@/lib/hydration/windows-native-scroll-script'
import { CHUNK_RECOVERY_SCRIPT } from '@/lib/hydration/chunk-recovery-script'
import { CRITICAL_HOME_CSS } from '@/lib/hydration/critical-home-css'
import { getBuildId } from '@/lib/build-id'
import { SPLARO_TAB_ICONS, splaroMetadataIcons } from '@splaro/config'
import { getStorefrontSettings } from '@/lib/storefront/settings'
import { serializeJsonLd } from '@/lib/seo/json-ld'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-cormorant',
  display: 'swap',
})

export const revalidate = 60

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splaro.co'
const cdnOrigin = (() => {
  const raw = process.env.NEXT_PUBLIC_CDN_URL?.trim()
  if (!raw) return 'https://cdn.splaro.co'
  try {
    return new URL(raw).origin
  } catch {
    return 'https://cdn.splaro.co'
  }
})()

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'SPLARO — Luxury Fashion & Lifestyle',
    template: '%s | SPLARO',
  },
  description:
    'Discover SPLARO — quiet luxury fashion for women, men, and kids. Premium essentials, footwear, and accessories with worldwide craft heritage.',
  keywords: [
    'SPLARO',
    'premium fashion',
    'summer edition',
    'men fashion',
    'women fashion',
    'kids fashion',
    'footwear',
    'premium storefront',
  ],
  authors: [{ name: 'SPLARO', url: siteUrl }],
  creator: 'SPLARO',
  publisher: 'SPLARO',
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
    locale: 'en_US',
    url: siteUrl,
    siteName: 'SPLARO',
    title: 'SPLARO — Luxury Fashion & Lifestyle',
    description:
      'Discover SPLARO — quiet luxury fashion for women, men, and kids. Premium essentials, footwear, and accessories.',
    images: [
      {
        url: `${siteUrl}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: 'SPLARO — Luxury Fashion & Lifestyle',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SPLARO — Luxury Fashion & Lifestyle',
    description: 'Quiet luxury fashion — premium essentials, footwear, and accessories.',
    images: [`${siteUrl}/og-image.jpg`],
    creator: '@splaro_official',
  },
  alternates: {
    canonical: siteUrl,
  },
  icons: splaroMetadataIcons,
  other: {
    'facebook-domain-verification': 'your-facebook-domain-verification-code',
  },
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
      style={{ colorScheme: 'light only' }}
    >
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        {/* Phone OS dark mode — keep SPLARO white/light on every device */}
        <meta name="color-scheme" content="only light" />
        <meta name="supported-color-schemes" content="light" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="splaro-build" content={buildId} />
        <GoogleAnalyticsHead />
        <link rel="preconnect" href={cdnOrigin} />
        <link rel="dns-prefetch" href={cdnOrigin} />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link rel="icon" href={SPLARO_TAB_ICONS.faviconIco} sizes="any" />
        <link rel="icon" href={SPLARO_TAB_ICONS.icon16} sizes="16x16" type="image/png" />
        <link rel="icon" href={SPLARO_TAB_ICONS.icon32} sizes="32x32" type="image/png" />
        <link rel="icon" href={SPLARO_TAB_ICONS.icon48} sizes="48x48" type="image/png" />
        <link rel="shortcut icon" href={faviconUrl || SPLARO_TAB_ICONS.faviconIco} />
        <link rel="apple-touch-icon" href={appleIconUrl} sizes="180x180" />
        <link rel="manifest" href="/icons/site.webmanifest" />
        {/* Structured Data — Organization
            Safe: content is fully static, no user-controlled input ever reaches here */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'SPLARO',
              url: siteUrl,
              logo: `${siteUrl}/images/logo/splaro-logo-black-premium.png`,
              description: 'Luxury fashion and lifestyle — designed for the world, rooted in heritage.',
              contactPoint: {
                '@type': 'ContactPoint',
                telephone: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
                contactType: 'customer service',
                availableLanguage: ['English'],
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
                  inLanguage: 'en',
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
                  description:
                    'Premium Bangladeshi fashion store — luxury women’s wear, ethnic & modest fashion, footwear, bags and accessories with nationwide delivery.',
                  priceRange: '৳৳',
                  currenciesAccepted: 'BDT',
                  paymentAccepted: 'Cash on Delivery, Mobile Banking, Card',
                  areaServed: { '@type': 'Country', name: 'Bangladesh' },
                },
              ],
            }),
          }}
        />
        <style id="splaro-critical-home" dangerouslySetInnerHTML={{ __html: CRITICAL_HOME_CSS }} />
      </head>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: STRIP_EXTENSION_ATTRS_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: WINDOWS_NATIVE_SCROLL_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: CHUNK_RECOVERY_SCRIPT }} />
        <div
          id="splaro-boot-fallback"
          role="alert"
          suppressHydrationWarning
          style={{
            display: 'none',
            position: 'fixed',
            insetInline: 0,
            bottom: 0,
            zIndex: 99999,
            padding: '12px 16px',
            textAlign: 'center',
            fontSize: '14px',
            fontWeight: 600,
            color: '#1c1917',
            background: '#fef3c7',
            borderTop: '1px solid rgba(217, 119, 6, 0.35)',
            boxShadow: '0 -8px 30px rgba(0,0,0,0.12)',
          }}
        >
          Site updated — please{' '}
          <Link
            href="/?_splaro=1"
            style={{
              marginInline: '4px',
              padding: '4px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(217, 119, 6, 0.45)',
              background: '#fff',
              fontWeight: 700,
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            refresh the page
          </Link>{' '}
          (Ctrl+Shift+R)
        </div>
        <Providers>
          <StorefrontSettingsProvider settings={settings}>
            <AnalyticsScripts envGaId={GA_ENV_ID} />
            <AttributionCapture />
            <StorefrontChrome>{children}</StorefrontChrome>
            <Toaster />
            <GlobalPressFeedback />
          </StorefrontSettingsProvider>
        </Providers>
      </body>
    </html>
  )
}
