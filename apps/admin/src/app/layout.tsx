import type { Metadata, Viewport } from 'next'
import { Inter, Noto_Sans_Bengali } from 'next/font/google'
import { STRIP_EXTENSION_ATTRS_SCRIPT, splaroMetadataIcons } from '@splaro/config'
import { Providers } from '@/components/layout/Providers'
import { DcThemeScript } from '@/components/dc/theme'
import './globals.css'
import '@/styles/dc.css'
// Loaded after globals so the DC login modifiers win over the legacy
// `.admin-auth-shell` base rules (same specificity — source order decides).
import '@/styles/admin-login-dc.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const notoBengali = Noto_Sans_Bengali({
  subsets: ['bengali'],
  variable: '--font-noto-bengali',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'SPLARO Commerce OS', template: '%s · SPLARO Commerce OS' },
  description: 'Ultra-premium Commerce Operating System for SPLARO luxury fashion.',
  robots: { index: false, follow: false },
  icons: splaroMetadataIcons,
}

/** Without this, phones render ~980px desktop layout and all ≤820px mobile CSS never matches. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${notoBengali.variable}`}
    >
      <head>
        <DcThemeScript />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: STRIP_EXTENSION_ATTRS_SCRIPT }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
