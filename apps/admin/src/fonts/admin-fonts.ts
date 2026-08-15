import localFont from 'next/font/local'

/** Local files — VPS `next build` must not fetch Google Fonts. */
export const inter = localFont({
  src: './inter-latin-wght.woff2',
  variable: '--font-inter',
  display: 'swap',
  weight: '100 900',
})

export const notoBengali = localFont({
  src: './noto-sans-bengali-wght.woff2',
  variable: '--font-noto-bengali',
  display: 'swap',
  weight: '100 900',
})
