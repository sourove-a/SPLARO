import localFont from 'next/font/local'

/** Local files — VPS builds must not depend on fonts.gstatic.com. */
export const inter = localFont({
  src: './inter-latin-wght.woff2',
  variable: '--font-inter',
  display: 'swap',
  preload: true,
  weight: '100 900',
})

export const cormorant = localFont({
  src: [
    { path: './cormorant-garamond-latin-400.woff2', weight: '400', style: 'normal' },
    { path: './cormorant-garamond-latin-500.woff2', weight: '500', style: 'normal' },
    { path: './cormorant-garamond-latin-600.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-cormorant',
  display: 'swap',
  preload: false,
})
