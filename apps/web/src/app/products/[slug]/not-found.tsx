import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import '@/styles/pages/content.css'
import '@/styles/pages/account.css'

export const metadata: Metadata = {
  title: 'Product not found',
  robots: { index: false, follow: false },
}

export default function ProductNotFound() {
  return (
    <div className="not-found-shell">
      <div className="not-found-shell__ambient" aria-hidden="true" />
      <div className="not-found-glass">
        <p className="not-found-code">404</p>
        <h1 className="not-found-title">Product not found</h1>
        <p className="not-found-text">
          This piece is no longer available or the link may be wrong.
        </p>
        <Link href="/shop" className="account-btn account-btn--primary not-found-btn">
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Back to Shop
        </Link>
      </div>
    </div>
  )
}
