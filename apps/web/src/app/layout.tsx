import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/layout/Providers'
import { StorefrontChrome } from '@/components/layout/StorefrontChrome'
import { Toaster } from '@/components/ui/Toast/Toaster'
import { StorefrontSettingsProvider } from '@/components/providers/StorefrontSettingsProvider'
import { AnalyticsScripts } from '@/components/analytics/AnalyticsScripts'
import { GoogleAnalyticsHead, GA_ENV_ID } from '@/components/analytics/GoogleAnalyticsHead'
import { AttributionCapture } from '@/components/analytics/AttributionCapture'
import { STRIP_EXTENSION_ATTRS_SCRIPT } from '@/lib/hydration/strip-extension-attrs'
import { SPLARO_TAB_ICONS, splaroMetadataIcons } from '@splaro/config'
import { getStorefrontSettings } from '@/lib/storefront/settings'

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

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'SPLARO — Premium Everyday Storefront',
    template: '%s | SPLARO',
  },
  description:
    'Discover SPLARO products across Summer Edition, Men, Women, Kids, and Footwear with a polished liquid-glass shopping experience.',
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
    title: 'SPLARO — Premium Everyday Storefront',
    description:
      'A polished SPLARO storefront for Summer Edition, Men, Women, Kids, and Footwear.',
    images: [
      {
        url: `${siteUrl}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: 'SPLARO — Premium Everyday Storefront',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SPLARO — Premium Everyday Storefront',
    description: 'A polished storefront for Summer Edition, Men, Women, Kids, and Footwear.',
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
  themeColor: '#FAF8F5',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getStorefrontSettings()
  const rawFavicon = settings.store.favicon?.trim() || ''
  const faviconUrl =
    !rawFavicon ||
    rawFavicon.includes('brand-mark-transparent') ||
    rawFavicon.includes('splaro-brand-mark-tab') ||
    rawFavicon.includes('favicon.svg')
      ? SPLARO_TAB_ICONS.icon48
      : rawFavicon
  const appleIconUrl =
    !rawFavicon ||
    rawFavicon.includes('brand-mark-transparent') ||
    rawFavicon.includes('splaro-brand-mark-tab') ||
    rawFavicon.includes('favicon.svg')
      ? SPLARO_TAB_ICONS.apple180
      : rawFavicon

  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${cormorant.variable}`}>
      <head>
        <GoogleAnalyticsHead />
        <link rel="preconnect" href="https://cdn.splaro.co" />
        <link rel="dns-prefetch" href="https://cdn.splaro.co" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link rel="icon" href={SPLARO_TAB_ICONS.icon32} sizes="32x32" type="image/png" />
        <link rel="icon" href={SPLARO_TAB_ICONS.icon48} sizes="48x48" type="image/png" />
        <link rel="shortcut icon" href={faviconUrl} />
        <link rel="apple-touch-icon" href={appleIconUrl} sizes="180x180" />
        {/* Structured Data — Organization
            Safe: content is fully static, no user-controlled input ever reaches here */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'SPLARO',
              url: siteUrl,
              logo: `${siteUrl}/images/logo/splaro-brand.svg`,
              description: 'Premium everyday fashion storefront',
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
            __html: JSON.stringify({
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
                  image: `${siteUrl}/images/logo/splaro-brand.svg`,
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
      </head>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: STRIP_EXTENSION_ATTRS_SCRIPT }} />
        <Providers>
          <StorefrontSettingsProvider settings={settings}>
            <AnalyticsScripts envGaId={GA_ENV_ID} />
            <AttributionCapture />
            <StorefrontChrome>{children}</StorefrontChrome>
            <Toaster />
          </StorefrontSettingsProvider>
        </Providers>
      </body>
    </html>
  )
}
