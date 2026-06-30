import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { STRIP_EXTENSION_ATTRS_SCRIPT } from '@splaro/config'
import { Providers } from '@/components/layout/Providers'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'SPLARO Commerce OS', template: '%s · SPLARO Commerce OS' },
  description: 'Ultra-premium Commerce Operating System for SPLARO luxury fashion.',
  robots: { index: false, follow: false },
  icons: {
    icon: '/images/logo/splaro-brand-mark-tab.png',
    apple: '/images/logo/splaro-brand-mark-tab-180.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="antialiased" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: STRIP_EXTENSION_ATTRS_SCRIPT }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
