import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { STRIP_EXTENSION_ATTRS_SCRIPT, splaroMetadataIcons } from '@splaro/config'
import { Providers } from '@/components/layout/Providers'
import './globals.css'
/* Wins light-mode cascade after globals premium/liquid passes */
import '../styles/admin-luxury-2027.css'
/* Solid shell layer — sidebar colour · header · module heroes */
import '../styles/admin-shell-premium.css'
/* Global click/hover feel — every button, tab, card, input */
import '../styles/admin-interactions-premium.css'
/* Design Monks–inspired violet accent + premium canvas */
import '../styles/admin-designmonks-accent.css'
/* Catalog / Products — Shadcn-kit composition */
import '../styles/admin-catalog-premium.css'
/* Final theme unify — one violet language across shell/settings/tables */
import '../styles/admin-theme-unify.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'SPLARO Commerce OS', template: '%s · SPLARO Commerce OS' },
  description: 'Ultra-premium Commerce Operating System for SPLARO luxury fashion.',
  robots: { index: false, follow: false },
  icons: splaroMetadataIcons,
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
