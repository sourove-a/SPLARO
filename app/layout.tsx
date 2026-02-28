import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Splaro | Official Luxury Registry',
  description: 'SPLARO luxury footwear and bags ecommerce platform.',
  metadataBase: new URL('https://splaro.co'),
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
    images: ['/favicon-512.png'],
  },
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
