import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Product not found',
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
}

export default function ProductMissingLayout({ children }: { children: React.ReactNode }) {
  return children
}
