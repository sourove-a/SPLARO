import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'SPLARO | Luxury Footwear & Bags',
    template: '%s | SPLARO',
  },
  description: 'SPLARO luxury footwear and bags ecommerce platform.',
  metadataBase: new URL('https://splaro.co'),
  keywords: ['splaro', 'luxury footwear', 'luxury bags', 'bangladesh ecommerce', 'premium shoes'],
  applicationName: 'SPLARO',
  category: 'shopping',
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/favicon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    title: 'SPLARO',
    description: 'Luxury footwear and bags.',
    images: ['/favicon-512.png'],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@splaro',
    creator: '@splaro',
    images: ['/favicon-512.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  colorScheme: 'dark light',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#060E1D' },
    { media: '(prefers-color-scheme: light)', color: '#16355F' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const runtimeVars = {
    NEXT_PUBLIC_BACKEND_MODE: process.env.NEXT_PUBLIC_BACKEND_MODE || '',
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || '',
    NEXT_PUBLIC_STOREFRONT_ORIGIN: process.env.NEXT_PUBLIC_STOREFRONT_ORIGIN || '',
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
    NEXT_PUBLIC_ADMIN_FORCE_STOREFRONT_API: process.env.NEXT_PUBLIC_ADMIN_FORCE_STOREFRONT_API || '',
    NEXT_PUBLIC_ALLOW_CROSS_ORIGIN_API: process.env.NEXT_PUBLIC_ALLOW_CROSS_ORIGIN_API || '',
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
        <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
        <Script
          id="splaro-runtime-vars"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.__SPLARO_RUNTIME__ = ${JSON.stringify(runtimeVars)};`,
          }}
        />
      </body>
    </html>
  );
}
